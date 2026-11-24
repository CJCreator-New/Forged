import path from "node:path";
import { readSwitches } from "../../config/switches";
import { getStyle } from "../../config/loaders";
import { ConfigError } from "../../config/errors";
import type { LintResult } from "../../linter";
import { writePost } from "../../store/posts";
import { localIsoWithOffset } from "../../store/posts";
import type { Channel, PostFrontmatter } from "../../schemas/post";
import type { Length } from "./channel";
import { DailyError } from "./errors";
import { channelTask, isReviewTopic, resolveLength } from "./channel";
import { DAY_FOLDER_LIKE } from "./requests";
import { readVoice, VOICE_FILE } from "./voice";
import { readBrief, type Brief } from "./day";
import { fileExists, presentLint, writeRawSafe } from "./post-io";
import { finishBody, generateChannelBody, humaniseDecision, type SwitchOverride } from "./generate";

// Drafts one channel post for a Day from its brief. Writes the post file (create-only) and the raw copy when humanised.

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

export async function draftPost(input: DraftInput, opts: DraftOptions = {}): Promise<DraftResult> {
  if (!DAY_FOLDER_LIKE.test(input.day_path)) throw new DailyError("bad_request", "day_path must point to a Day folder.");
  checkStyle(input.style);
  const target = resolveLength(input.channel, input.length, input.custom_target);

  const voice = await readVoice(opts.voicePath ?? VOICE_FILE);
  const brief = await readBrief(input.day_path);

  const postRel = `${input.day_path}/${input.channel}.md`;
  if (await fileExists(postRel)) {
    throw new DailyError("post_exists", `A ${input.channel} post already exists for this day. Change its length or variants instead.`);
  }

  const switches = readSwitches();
  const runHumanise = humaniseDecision(input.humanise, switches.humanise);

  const generated = await generateChannelBody({
    voice,
    channel: input.channel,
    length: target,
    styleId: input.style,
    source: angleSource(brief),
  });
  const finished = await finishBody({
    voice,
    channel: input.channel,
    channelTaskText: channelTask(input.channel, target),
    topic: brief.topic,
    text: generated.body,
    runHumanise,
  });

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
  if (finished.raw !== undefined) await writeRawSafe(postRel, finished.raw);

  return {
    post_path: postRel,
    lint: presentLint(finished.lint, switches.linter_soft_warnings),
    humanised: finished.humanised,
  };
}
