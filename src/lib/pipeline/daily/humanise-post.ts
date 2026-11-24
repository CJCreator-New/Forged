import { readSwitches } from "../../config/switches";
import { readPost, replaceGeneratedBody } from "../../store/posts";
import { channelTask, resolveLength } from "./channel";
import { DailyError } from "./errors";
import { readVoice, VOICE_FILE } from "./voice";
import { ensurePostNotEdited, updatePostFields, writeRawSafe } from "./post-io";
import { finishBody, humaniseDecision } from "./generate";

// The humanise pass on one existing post. Runs only when the post override or the session switch allows it.
// The pre-pass text is kept as the raw copy, and the rewrite becomes the body.

export async function humanisePost(
  input: { post_path: string },
  opts: { voicePath?: string } = {},
): Promise<{ post_path: string; raw_path: string; previous_path: string }> {
  const post = await readPost(input.post_path);
  const fm = post.frontmatter;

  const switches = readSwitches();
  if (!humaniseDecision(fm.humanise, switches.humanise)) {
    throw new DailyError(
      "humanise_off",
      "Humanise is off for this post. Turn it on in settings, or set this post to on, then try again.",
    );
  }

  await ensurePostNotEdited(input.post_path);

  const voice = await readVoice(opts.voicePath ?? VOICE_FILE);
  const target = resolveLength(fm.channel, fm.length, fm.custom_target);
  const finished = await finishBody({
    voice,
    channel: fm.channel,
    channelTaskText: channelTask(fm.channel, target),
    topic: fm.topic,
    text: post.body,
    runHumanise: true,
  });

  const rawPath = await writeRawSafe(input.post_path, post.body);
  const { versionPath } = await replaceGeneratedBody(input.post_path, finished.body, { force: false });
  // Changing the body resets the status to draft (glossary: Status).
  await updatePostFields(input.post_path, { status: "draft", humanised: true, lint: finished.lint });

  return { post_path: input.post_path, raw_path: rawPath, previous_path: versionPath };
}
