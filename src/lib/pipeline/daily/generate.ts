import { z } from "zod";
import { lintText, type LintResult } from "../../linter";
import { runWithFallback } from "../../gateway/fallback";
import { runJson } from "../../gateway/json";
import { getStyle } from "../../config/loaders";
import type { ChatMessage } from "../../gateway/openrouter";
import { SWITCH_OVERRIDES, type Channel } from "../../schemas/post";
import { DailyError } from "./errors";
import { isReviewTopic, lengthLine, channelTask, rangeText, type LengthTarget } from "./channel";
import { buildDraftPrompt, buildHumanisePrompt, FOOTER } from "./prompts";

// Shared text steps for every daily post: adapt (P3, P4, P5), humanise (P7), and lint.

export type SwitchOverride = (typeof SWITCH_OVERRIDES)[number];

export const HumaniseSchema = z.object({
  rewrite: z.string().min(1),
  changes: z.array(z.string()),
});

// Humanise runs when the post's own override says so, otherwise the session switch decides.
// "on" runs even when the switch is off. "off" never runs. "inherit" follows the switch.
export function humaniseDecision(override: SwitchOverride, switchOn: boolean): boolean {
  if (override === "on") return true;
  if (override === "off") return false;
  return switchOn;
}

export function lintBody(channel: Channel, topic: string, body: string): LintResult {
  return lintText(body, { channel, topic, reviewRequired: isReviewTopic(topic) });
}

export type GeneratedText = {
  body: string;
  model: string;
  fallback_from?: string;
};

// Writes the channel body with the adapt task (P3, P4, P5). If the body is over the hard max,
// asks once for a shorter rewrite. If it is still over, the body is returned and lint rule H5 blocks export.
export async function generateChannelBody(input: {
  voice: string;
  channel: Channel;
  length: LengthTarget;
  styleId: string;
  source: string;
  keepOpening?: string;
}): Promise<GeneratedText> {
  const style = getStyle(input.styleId);
  const base = buildDraftPrompt({
    voice: input.voice,
    channelTask: channelTask(input.channel, input.length),
    lengthLine: lengthLine(input.length),
    styleGuidance: style.guidance,
    source: input.source,
    keepOpening: input.keepOpening,
  });

  const first = await runWithFallback("adapt", [{ role: "user", content: base }]);
  let text = first.text.trim();
  let model = first.model_used;
  let fallbackFrom = first.fallback_from;

  if (text.length > input.length.hardMax) {
    const correction = `Your text is ${text.length} characters, over the limit of ${input.length.hardMax}. Rewrite it under ${input.length.hardMax} characters, aiming for ${rangeText(input.length)}. Keep every fact. Return the post text only. ${FOOTER}`;
    const messages: ChatMessage[] = [
      { role: "user", content: base },
      { role: "assistant", content: text },
      { role: "user", content: correction },
    ];
    const retry = await runWithFallback("adapt", messages);
    text = retry.text.trim();
    model = retry.model_used;
    fallbackFrom = fallbackFrom ?? retry.fallback_from;
  }

  if (text === "") {
    throw new DailyError("invalid_output", "The model returned an empty post. Try again.");
  }
  return { body: text, model, ...(fallbackFrom ? { fallback_from: fallbackFrom } : {}) };
}

export type FinishedBody = {
  body: string;
  humanised: boolean;
  raw?: string;
  lint: LintResult;
};

// Runs the humanise pass when asked, then lints the final body.
// The rewrite becomes the body and the text before the pass is returned as raw.
export async function finishBody(input: {
  voice: string;
  channel: Channel;
  channelTaskText: string;
  topic: string;
  text: string;
  runHumanise: boolean;
}): Promise<FinishedBody> {
  if (!input.runHumanise) {
    return { body: input.text, humanised: false, lint: lintBody(input.channel, input.topic, input.text) };
  }
  const prompt = buildHumanisePrompt({
    voice: input.voice,
    channelTask: input.channelTaskText,
    text: input.text,
  });
  const result = await runJson("humanise", [{ role: "user", content: prompt }], HumaniseSchema);
  const rewrite = result.data.rewrite.trim();
  return {
    body: rewrite,
    humanised: true,
    raw: input.text,
    lint: lintBody(input.channel, input.topic, rewrite),
  };
}
