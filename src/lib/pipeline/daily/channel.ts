import { loadChannels } from "../../config/loaders";
import { LENGTHS, type Channel } from "../../schemas/post";
import { DailyError } from "./errors";

// Turns channel limits and a length tier into the numbers the prompts and linter need.

export type Length = (typeof LENGTHS)[number];

export type LengthTarget = {
  tier: Length;
  unit: "characters" | "words";
  min: number;
  max: number;
  target: number | null; // set only for custom
  hardMax: number; // characters, always
  hookMax: number;
  hashtags: { min: number; max: number };
};

const LABEL: Record<Channel, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
};

export function channelLabel(channel: Channel): string {
  return LABEL[channel];
}

export function resolveLength(channel: Channel, length: Length, customTarget?: number): LengthTarget {
  const cfg = loadChannels()[channel];
  const common = {
    hardMax: cfg.hard_max_chars,
    hookMax: cfg.hook_max_chars,
    hashtags: cfg.hashtags,
  };

  if (length === "custom") {
    if (customTarget === undefined || !Number.isInteger(customTarget) || customTarget <= 0) {
      throw new DailyError("bad_request", "A custom length needs a whole number target.");
    }
    const unit = cfg.lengths.medium.unit;
    if (unit === "characters" && customTarget > cfg.hard_max_chars) {
      throw new DailyError(
        "length_too_long",
        `The custom target is over the ${channelLabel(channel)} hard max of ${cfg.hard_max_chars} characters.`,
      );
    }
    return { tier: "custom", unit, min: customTarget, max: customTarget, target: customTarget, ...common };
  }

  const range = cfg.lengths[length];
  return { tier: length, unit: range.unit, min: range.min, max: range.max, target: null, ...common };
}

// One line per channel, from config, for prompts that cover all three channels (the ideas step).
export function channelSummary(): string {
  const cfg = loadChannels();
  return (Object.keys(LABEL) as Channel[])
    .map((c) => {
      const ch = cfg[c];
      return `${LABEL[c]}: hook within ${ch.hook_max_chars} characters, body hard max ${ch.hard_max_chars} characters, ${ch.hashtags.min} to ${ch.hashtags.max} hashtags.`;
    })
    .join("\n");
}

export function rangeText(t: LengthTarget): string {
  if (t.target !== null) return `about ${t.target} ${t.unit}`;
  return `${t.min} to ${t.max} ${t.unit}`;
}

export function lengthLine(t: LengthTarget): string {
  return `Length tier: ${t.tier}. Body must be ${rangeText(t)}, and never more than ${t.hardMax} characters.`;
}

// The one-line task for each channel, from doc 04 section 7 (P3, P4, P5), with limits from config.
export function channelTask(channel: Channel, t: LengthTarget): string {
  const tags = `${t.hashtags.min} to ${t.hashtags.max} hashtags`;
  if (channel === "linkedin") {
    return `Write one LinkedIn post. Hook within ${t.hookMax} characters. ${tags}. At most one question at the end.`;
  }
  if (channel === "instagram") {
    return `Write one Instagram caption. Hook within ${t.hookMax} characters. ${tags} at the end.`;
  }
  return `Write one Facebook post in plain paragraphs. ${tags}. At most one question.`;
}

// Topics that need a review tick before export (healthcare and HR, from the PRD and glossary).
const REVIEW_TOPIC = /\b(health|healthcare|medical|hr|human resources|people)\b/i;

export function isReviewTopic(topic: string): boolean {
  return REVIEW_TOPIC.test(topic);
}
