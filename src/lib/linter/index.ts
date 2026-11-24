import channelsJson from "../../../config/channels.json";

export type Channel = "linkedin" | "instagram" | "facebook";

export interface LintContext {
  channel: Channel;
  topic: string;
  hookText?: string;
  hashtagCount?: number;
  reviewRequired?: boolean;
  hasQuestionCta?: boolean;
  hasStatWithoutSource?: boolean;
}

export interface LintResult {
  hard: string[];
  soft: string[];
}

interface ChannelLimits {
  hook_max_chars: number;
  hard_max_chars: number;
  hashtags: { min: number; max: number };
}

const CHANNELS = channelsJson as Record<Channel, ChannelLimits>;

const CHANNEL_NAMES: Record<Channel, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
};

const EMOJI = /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Modifier}|⃣/gu;
const EM_DASH = /\u2014/g;
const EN_DASH = /\u2013/g;
const DOUBLE_HYPHEN = /--/g;

const ENGAGEMENT_BAIT = [
  /\bcomment\s+yes\b/i,
  /\bcomment\s+below\s+to\s+get\b/i,
  /\btag\s+a\s+friend\b/i,
  /\btag\s+someone\s+who\b/i,
  /\bshare\s+if\s+you\s+agree\b/i,
  /\blike\s+if\b/i,
];

const MEDICAL_CLAIMS = [
  /\bcures?\b/i,
  /\bguaranteed\s+results?\b/i,
  /\bclinically\s+proven\b/i,
  /\breplaces?\s+your\s+doctor\b/i,
  /\bguaranteed\s+to\s+heal\b/i,
];

const AI_TELL_WORDS = [
  /\bleverag(e|es|ed|ing)\b/i,
  /\bdelv(e|es|ed|ing)\b/i,
  /\bgame[- ]?changers?\b/i,
  /\bunlock(s|ed|ing)?\b/i,
  /\bin today[’']?s fast-paced world\b/i,
  /\bhere[’']?s the thing\b/i,
  /\bpivotal\b/i,
  /\btransformative\b/i,
  /\brevolutionary\b/i,
];

interface Hit {
  match: string;
  index: number;
}

function findAll(text: string, pattern: RegExp): Hit[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  const hits: Hit[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    hits.push({ match: m[0], index: m.index });
    if (m[0].length === 0) re.lastIndex++;
  }
  return hits;
}

function firstLine(text: string): string {
  return text.trim().split("\n")[0] ?? "";
}

// True when a capitalised pair at `index` begins a sentence, a line, or a list item.
function startsSentence(text: string, index: number): boolean {
  const before = text.slice(0, index);
  const trimmed = before.replace(/\s+$/, "");
  const gap = before.slice(trimmed.length);
  if (trimmed.length === 0) return true;
  if (gap.includes("\n")) return true;
  return /[.!?*#>\-•]$/.test(trimmed);
}

function checkEmojis(text: string, hard: string[]): void {
  for (const hit of findAll(text, EMOJI)) {
    hard.push(`H1: emoji found at position ${hit.index}`);
  }
}

function checkDashes(text: string, hard: string[], soft: string[]): void {
  for (const hit of findAll(text, EM_DASH)) {
    hard.push(`H2: em dash found at position ${hit.index}`);
  }
  for (const hit of findAll(text, EN_DASH)) {
    hard.push(`H2: en dash found at position ${hit.index}`);
  }
  for (const hit of findAll(text, DOUBLE_HYPHEN)) {
    soft.push(`S7: double hyphen found at position ${hit.index}`);
  }
}

function checkEngagementBait(text: string, hard: string[]): void {
  for (const pattern of ENGAGEMENT_BAIT) {
    for (const hit of findAll(text, pattern)) {
      hard.push(`H3: engagement bait found ("${hit.match}")`);
    }
  }
}

// A cited source in the same sentence clears a "clinically proven" claim.
const SOURCE_MARKER = /\(\s*source|\(\s*ref|\[\d+\]|source:/i;

function sentenceAround(text: string, index: number): string {
  const before = text.slice(0, index).split(/[.!?]/).pop() ?? "";
  const after = text.slice(index).split(/[.!?]/)[0] ?? "";
  return before + after;
}

function checkMedicalClaims(text: string, ctx: LintContext, hard: string[]): void {
  if (!ctx.topic.toLowerCase().includes("health")) return;
  for (const pattern of MEDICAL_CLAIMS) {
    for (const hit of findAll(text, pattern)) {
      const sourced = SOURCE_MARKER.test(sentenceAround(text, hit.index));
      if (/clinically/i.test(hit.match) && sourced) continue;
      hard.push(`H4: medical claim found ("${hit.match}")`);
    }
  }
}

function checkLengths(text: string, ctx: LintContext, hard: string[]): void {
  const limits = CHANNELS[ctx.channel];
  const label = CHANNEL_NAMES[ctx.channel];
  if (text.length > limits.hard_max_chars) {
    hard.push(
      `H5: body is ${text.length} characters, over the ${label} hard max of ${limits.hard_max_chars}`,
    );
  }
  const hook = ctx.hookText ?? text.slice(0, limits.hook_max_chars);
  if (hook.length > limits.hook_max_chars) {
    hard.push(
      `H5: hook is ${hook.length} characters, over the ${label} hook limit of ${limits.hook_max_chars}`,
    );
  }
}

function checkAiTellWords(text: string, soft: string[]): void {
  for (const pattern of AI_TELL_WORDS) {
    for (const hit of findAll(text, pattern)) {
      soft.push(`S1: AI-tell word found ("${hit.match}")`);
    }
  }
}

function checkHookLength(text: string, ctx: LintContext, soft: string[]): void {
  const limit = CHANNELS[ctx.channel].hook_max_chars;
  const hook = ctx.hookText ?? firstLine(text);
  if (hook.length > limit) {
    soft.push(
      `S2: hook is ${hook.length} characters, over the ${CHANNEL_NAMES[ctx.channel]} visible limit of ${limit}`,
    );
  }
}

function checkQuestionCta(text: string, ctx: LintContext, soft: string[]): void {
  if (!ctx.hasQuestionCta) return;
  const sentences = text.trim().match(/[^.!?]*[.!?]+|[^.!?]+$/g) ?? [];
  const closing = sentences.slice(-2).join("");
  const count = (closing.match(/\?/g) ?? []).length;
  if (count > 1) {
    soft.push(`S3: ${count} question marks in the closing two sentences, keep one question CTA`);
  }
}

function checkHashtags(text: string, ctx: LintContext, soft: string[]): void {
  const count =
    ctx.hashtagCount ?? (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;
  const limits = CHANNELS[ctx.channel].hashtags;
  const label = CHANNEL_NAMES[ctx.channel];
  if (count > limits.max) {
    soft.push(`S4: ${count} hashtags, over the ${label} max of ${limits.max}`);
  }
  if (count < limits.min) {
    soft.push(`S4: ${count} hashtags, under the ${label} min of ${limits.min}`);
  }
}

function checkNames(text: string, ctx: LintContext, soft: string[]): void {
  const topic = ctx.topic.toLowerCase();
  if (!(/\bhr\b/.test(topic) || topic.includes("people"))) return;
  for (const hit of findAll(text, /\b[A-Z][a-z]+[ \t]+[A-Z][a-z]+\b/g)) {
    if (!startsSentence(text, hit.index)) {
      soft.push(
        `S5: possible name or employer "${hit.match}" at position ${hit.index}, check before export`,
      );
    }
  }
}

function checkStatSource(ctx: LintContext, soft: string[]): void {
  if (ctx.hasStatWithoutSource) {
    soft.push("S6: stat has no source noted, confirm the source before publishing");
  }
}

function checkReviewTick(ctx: LintContext, soft: string[]): void {
  if (ctx.reviewRequired) {
    soft.push("Review tick needed before export");
  }
}

/**
 * Runs every linter rule on a post body. Pure function: no I/O, no model calls.
 * Hard messages block export. Soft messages warn inline.
 */
export function lintText(text: string, ctx: LintContext): LintResult {
  const hard: string[] = [];
  const soft: string[] = [];

  checkEmojis(text, hard);
  checkDashes(text, hard, soft);
  checkEngagementBait(text, hard);
  checkMedicalClaims(text, ctx, hard);
  checkLengths(text, ctx, hard);
  checkAiTellWords(text, soft);
  checkHookLength(text, ctx, soft);
  checkQuestionCta(text, ctx, soft);
  checkHashtags(text, ctx, soft);
  checkNames(text, ctx, soft);
  checkStatSource(ctx, soft);
  checkReviewTick(ctx, soft);

  return { hard, soft };
}
