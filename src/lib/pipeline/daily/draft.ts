import path from "node:path";
import { readSwitches } from "../../config/switches";
import { getStyle } from "../../config/loaders";
import { ConfigError } from "../../config/errors";
import type { LintResult } from "../../linter";
import { readPost, replaceGeneratedBody, writePost } from "../../store/posts";
import { localIsoWithOffset } from "../../store/posts";
import type { Channel, PostFrontmatter } from "../../schemas/post";
import type { Length } from "./channel";
import { DailyError } from "./errors";
import { channelTask, isReviewTopic, resolveLength } from "./channel";
import { DAY_FOLDER_LIKE } from "./requests";
import { readVoice, VOICE_FILE } from "./voice";
import { readBrief, type Brief } from "./day";
import { ensurePostNotEdited, fileExists, presentLint, updatePostFields, writeRawSafe } from "./post-io";
import { finishBody, generateChannelBody, humaniseDecision, type SwitchOverride } from "./generate";

// Drafts one channel post for a Day. A new post is created. An existing post is regenerated: its old body is
// kept under versions/ by replaceGeneratedBody, and a user-edited post is refused before any model call (ADR 0007).

export type DraftInput = {
  day_path: string;
  channel: Channel;
  length: Length;
  custom_target?: number;
  style: string;
  humanise: SwitchOverride;
};

export type DraftOptions = { voicePath?: string; now?: Date };

export type DraftResult = {
  post_path: string;
  lint: LintResult;
  humanised: boolean;
};

export function angleSource(brief: Brief): string {
  return [
    `Title: ${brief.angle_title}`,
    `Format: ${brief.format}`,
    `Why it could travel: ${brief.why_it_could_travel}`,
    "Hook options:",
    ...brief.hooks.map((h) => `- ${h}`),
  ].join("\n");
}

export function checkStyle(id: string): void {
  try {
    getStyle(id);
  } catch (err) {
    if (err instanceof ConfigError) throw new DailyError("bad_request", `Unknown writing style "${id}".`);
    throw err;
  }
}

type Source = { topic: string; text: string; brief: Brief | null };

// Uses the Day's brief. A Day made by the Week flow has no brief, so a post that already exists
// is regenerated from its own frontmatter instead.
async function sourceFor(dayPath: string, existing: PostFrontmatter | null): Promise<Source> {
  try {
    const brief = await readBrief(dayPath);
    return { topic: brief.topic, text: angleSource(brief), brief };
  } catch (err) {
    if (!existing || !(err instanceof DailyError) || err.code !== "not_found") throw err;
    return {
      topic: existing.topic,
      text: `Title: ${existing.angle}\nFormat: ${existing.format}\nTopic: ${existing.topic}`,
      brief: null,
    };
  }
}

export async function draftPost(input: DraftInput, opts: DraftOptions = {}): Promise<DraftResult> {
  if (!DAY_FOLDER_LIKE.test(input.day_path)) throw new DailyError("bad_request", "day_path must point to a Day folder.");
  checkStyle(input.style);
  const target = resolveLength(input.channel, input.length, input.custom_target);

  const postRel = `${input.day_path}/${input.channel}.md`;
  const existing = (await fileExists(postRel)) ? (await readPost(postRel)).frontmatter : null;
  if (existing) await ensurePostNotEdited(postRel);

  const voice = await readVoice(opts.voicePath ?? VOICE_FILE);
  const source = await sourceFor(input.day_path, existing);

  const switches = readSwitches();
  const runHumanise = humaniseDecision(input.humanise, switches.humanise);

  const generated = await generateChannelBody({
    voice,
    channel: input.channel,
    length: target,
    styleId: input.style,
    source: source.text,
  });
  const finished = await finishBody({
    voice,
    channel: input.channel,
    channelTaskText: channelTask(input.channel, target),
    topic: source.topic,
    text: generated.body,
    runHumanise,
  });

  if (existing) {
    await replaceGeneratedBody(postRel, finished.body, { force: false });
    const patch: Partial<PostFrontmatter> & Record<string, unknown> = {
      model: generated.model,
      humanised: finished.humanised,
      humanise: input.humanise,
      length: input.length,
      style: input.style,
      lint: finished.lint,
    };
    const removeKeys: (keyof PostFrontmatter)[] = [];
    if (generated.fallback_from) patch.fallback_from = generated.fallback_from;
    else removeKeys.push("fallback_from");
    if (input.length === "custom") patch.custom_target = input.custom_target;
    else removeKeys.push("custom_target");
    await updatePostFields(postRel, patch, removeKeys);
  } else {
    if (!source.brief) throw new DailyError("not_found", "This day has no angle yet. Pick an angle first.");
    const brief = source.brief;
    const now = opts.now ?? new Date();
    const frontmatter: Partial<PostFrontmatter> & Record<string, unknown> = {
      id: `${path.posix.basename(input.day_path)}-${input.channel}`,
      channel: input.channel,
      status: "draft",
      topic: brief.topic,
      angle: brief.angle_title,
      format: brief.format,
      model: generated.model,
      created: localIsoWithOffset(now),
      length: input.length,
      style: input.style,
      humanise: input.humanise,
      humanised: finished.humanised,
      variant_index: 1,
      selected: true,
      rendered: false,
      edit_rating: null,
      review_required: isReviewTopic(brief.topic),
      stale: false,
      lint: finished.lint,
    };
    if (generated.fallback_from) frontmatter.fallback_from = generated.fallback_from;
    if (input.length === "custom") frontmatter.custom_target = input.custom_target;
    await writePost(postRel, frontmatter, finished.body);
  }

  if (finished.raw !== undefined) await writeRawSafe(postRel, finished.raw);

  return {
    post_path: postRel,
    lint: presentLint(finished.lint, switches.linter_soft_warnings),
    humanised: finished.humanised,
  };
}
