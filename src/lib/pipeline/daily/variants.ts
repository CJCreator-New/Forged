import { z } from "zod";
import { readSwitches } from "../../config/switches";
import { runJson } from "../../gateway/json";
import type { LintResult } from "../../linter";
import { readPost, writePost, localIsoWithOffset } from "../../store/posts";
import type { Channel, PostFrontmatter } from "../../schemas/post";
import { DailyError } from "./errors";
import { channelTask, isReviewTopic, resolveLength } from "./channel";
import { POST_FILE_LIKE } from "./requests";
import { buildVariantsPrompt } from "./prompts";
import { readVoice, VOICE_FILE } from "./voice";
import { fileExists, dayFolder, presentLint, writeRawSafe } from "./post-io";
import { finishBody, humaniseDecision } from "./generate";

// Variants (P9). Only made when asked. Each one is saved as variants/<channel>-v<n>.md and linted on its own.

export function variantPath(postRelPath: string, channel: Channel, n: number): string {
  return `${dayFolder(postRelPath)}/variants/${channel}-v${n}.md`;
}

export function variantsSchema(count: number) {
  return z
    .array(
      z.object({
        variant_index: z.number().int(),
        hook: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .length(count);
}

export type VariantsOptions = { voicePath?: string; now?: Date };

export type VariantsResult = {
  variants: { variant_index: number; path: string; lint: LintResult }[];
};

// Picks the lowest free variant numbers, so earlier variants are never overwritten.
async function freeIndices(postRelPath: string, channel: Channel, count: number): Promise<number[]> {
  const found: number[] = [];
  for (let n = 1; found.length < count; n++) {
    if (!(await fileExists(variantPath(postRelPath, channel, n)))) found.push(n);
  }
  return found;
}

export async function generateVariants(
  input: { post_path: string; count?: 2 | 3 },
  opts: VariantsOptions = {},
): Promise<VariantsResult> {
  if (!POST_FILE_LIKE.test(input.post_path)) throw new DailyError("bad_request", "post_path must point to a post file.");

  const switches = readSwitches();
  const count = input.count ?? (switches.variants === 3 ? 3 : 2);
  if (count !== 2 && count !== 3) throw new DailyError("bad_request", "count must be 2 or 3.");

  const voice = await readVoice(opts.voicePath ?? VOICE_FILE);
  const post = await readPost(input.post_path);
  const fm = post.frontmatter;
  const target = resolveLength(fm.channel, fm.length, fm.custom_target);

  const prompt = buildVariantsPrompt({
    voice,
    channelTask: channelTask(fm.channel, target),
    count,
    selectedPost: post.body,
  });
  const generated = await runJson("variants", [{ role: "user", content: prompt }], variantsSchema(count));

  const runHumanise = humaniseDecision(fm.humanise, switches.humanise);
  const finished = await Promise.all(
    generated.data.map((v) => {
      const text = v.body.trim().startsWith(v.hook.trim()) ? v.body.trim() : `${v.hook.trim()}\n\n${v.body.trim()}`;
      return finishBody({
        voice,
        channel: fm.channel,
        channelTaskText: channelTask(fm.channel, target),
        topic: fm.topic,
        text,
        runHumanise,
      });
    }),
  );

  const indices = await freeIndices(input.post_path, fm.channel, count);
  const now = opts.now ?? new Date();
  const results: VariantsResult["variants"] = [];

  for (let i = 0; i < count; i++) {
    const n = indices[i];
    const rel = variantPath(input.post_path, fm.channel, n);
    const done = finished[i];
    const frontmatter: Partial<PostFrontmatter> & Record<string, unknown> = {
      id: `${fm.id}-v${n}`,
      channel: fm.channel,
      status: "draft",
      topic: fm.topic,
      angle: fm.angle,
      format: fm.format,
      model: generated.model_used,
      created: localIsoWithOffset(now),
      length: fm.length,
      style: fm.style,
      humanise: fm.humanise,
      humanised: done.humanised,
      variant_index: n,
      selected: false,
      rendered: false,
      edit_rating: null,
      review_required: isReviewTopic(fm.topic),
      stale: false,
      lint: done.lint,
    };
    if (generated.fallback_from) frontmatter.fallback_from = generated.fallback_from;
    if (fm.custom_target !== undefined) frontmatter.custom_target = fm.custom_target;

    await writePost(rel, frontmatter, done.body);
    if (done.raw !== undefined) await writeRawSafe(rel, done.raw);
    results.push({ variant_index: n, path: rel, lint: presentLint(done.lint, switches.linter_soft_warnings) });
  }

  return { variants: results };
}
