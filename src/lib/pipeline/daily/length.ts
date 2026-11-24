import { readSwitches } from "../../config/switches";
import type { LintResult } from "../../linter";
import { readPost, replaceGeneratedBody } from "../../store/posts";
import type { PostFrontmatter } from "../../schemas/post";
import type { Length } from "./channel";
import { channelTask, resolveLength } from "./channel";
import { readVoice, VOICE_FILE } from "./voice";
import { ensurePostNotEdited, presentLint, updatePostFields, writeRawSafe } from "./post-io";
import { finishBody, generateChannelBody, humaniseDecision } from "./generate";

// Regenerates one post body at a new length. The hook (opening paragraph) is kept close.
// The previous body is saved under versions/ before the new one is written.

export type LengthOptions = { voicePath?: string };

export type LengthResult = {
  post_path: string;
  previous_path: string;
  lint: LintResult;
};

function firstParagraph(text: string): string {
  return text.trim().split(/\n\s*\n/)[0] ?? "";
}

export async function changeLength(
  input: { post_path: string; length: Length; custom_target?: number },
  opts: LengthOptions = {},
): Promise<LengthResult> {
  const post = await readPost(input.post_path);
  const fm = post.frontmatter;

  await ensurePostNotEdited(input.post_path);

  const target = resolveLength(fm.channel, input.length, input.custom_target);
  const voice = await readVoice(opts.voicePath ?? VOICE_FILE);
  const switches = readSwitches();

  const generated = await generateChannelBody({
    voice,
    channel: fm.channel,
    length: target,
    styleId: fm.style,
    source: `Angle: ${fm.angle}\n\nCurrent post text:\n${post.body.trim()}`,
    keepOpening: firstParagraph(post.body),
  });

  const finished = await finishBody({
    voice,
    channel: fm.channel,
    channelTaskText: channelTask(fm.channel, target),
    topic: fm.topic,
    text: generated.body,
    runHumanise: humaniseDecision(fm.humanise, switches.humanise),
  });

  const { versionPath } = await replaceGeneratedBody(input.post_path, finished.body, { force: false });
  if (finished.raw !== undefined) await writeRawSafe(input.post_path, finished.raw);

  // Changing the body resets the status to draft (glossary: Status).
  const patch: Partial<PostFrontmatter> = {
    status: "draft",
    length: input.length,
    model: generated.model,
    humanised: finished.humanised,
    lint: finished.lint,
  };
  if (input.length === "custom") patch.custom_target = input.custom_target;
  const removeKeys: (keyof PostFrontmatter)[] = [];
  if (input.length !== "custom") removeKeys.push("custom_target");
  if (generated.fallback_from) patch.fallback_from = generated.fallback_from;
  else removeKeys.push("fallback_from");
  await updatePostFields(input.post_path, patch, removeKeys);

  return {
    post_path: input.post_path,
    previous_path: versionPath,
    lint: presentLint(finished.lint, switches.linter_soft_warnings),
  };
}
