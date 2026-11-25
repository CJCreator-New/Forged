export type Platform = "linkedin" | "instagram" | "facebook";
export type Length = "short" | "medium" | "long";

export interface LintInput {
  platform: Platform;
  body: string;
  hook?: string;
  hashtags?: string[];
  questionCount?: number;
  length?: Length;
  reviewRequired?: boolean;
  softWarnings?: boolean;
}

export interface Issue {
  id: string;
  message: string;
}

export interface LintResult {
  hard: Issue[];
  soft: Issue[];
  passed: boolean;
}

const EMOJI_RE =
  /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{20E3}]|\p{Extended_Pictographic}\u{200D}|\u{200D}\p{Extended_Pictographic}/u;

/** True when the text contains an emoji, flag, skin tone, keycap, or emoji joiner sequence. */
export function hasEmoji(text: string): boolean {
  return EMOJI_RE.test(text);
}

/** True when the text contains an em dash (U+2014). */
export function hasEmDash(text: string): boolean {
  return text.includes("\u2014");
}

const BAIT_PHRASES = [
  "comment yes",
  "tag a friend",
  "tag someone who",
  "share if you agree",
  "like if you agree",
  "like if",
  "comment below if",
  "double tap if",
];

const MEDICAL_PHRASES = ["cures", "guaranteed results", "replaces your doctor"];

const AI_TELLS = [
  "leverage",
  "delve",
  "game-changer",
  "unlock",
  "in today's fast-paced world",
  "here's the thing",
];

const HARD_MAX: Record<Platform, number | null> = {
  linkedin: 3000,
  instagram: 2200,
  facebook: null,
};

const HOOK_LIMIT: Record<Platform, number | null> = {
  linkedin: 200,
  instagram: 125,
  facebook: null,
};

const HASHTAG_LIMIT: Record<Platform, number> = {
  linkedin: 3,
  instagram: 5,
  facebook: 2,
};

const LENGTH_RANGES: Record<Platform, Record<Length, [number, number]>> = {
  linkedin: { short: [300, 600], medium: [600, 1300], long: [1300, 2000] },
  instagram: { short: [80, 150], medium: [150, 600], long: [600, 1200] },
  facebook: { short: [20, 50], medium: [50, 150], long: [150, 300] },
};

function normalise(text: string): string {
  return text.toLowerCase().replace(/[\u2018\u2019]/g, "'");
}

export function countWords(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

function hasSource(body: string): boolean {
  return /source\s*:/i.test(body) || /https?:\/\/\S+/i.test(body);
}

function containsWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${escaped}`, "i").test(haystack);
}

export function lintPost(input: LintInput): LintResult {
  const { platform, body } = input;
  const hard: Issue[] = [];
  const soft: Issue[] = [];
  const lower = normalise(body);

  if (hasEmoji(body)) {
    hard.push({ id: "H1", message: "Post contains an emoji." });
  }
  if (hasEmDash(body)) {
    hard.push({ id: "H2", message: "Post contains an em dash." });
  }
  const bait = BAIT_PHRASES.find((p) => lower.includes(p));
  if (bait) {
    hard.push({ id: "H3", message: `Engagement bait phrase: "${bait}".` });
  }
  const medical = MEDICAL_PHRASES.find((p) => containsWord(lower, p));
  if (medical) {
    hard.push({ id: "H4", message: `Medical claim: "${medical}".` });
  } else if (lower.includes("clinically proven") && !hasSource(body)) {
    hard.push({
      id: "H4",
      message: 'Medical claim "clinically proven" with no source cited.',
    });
  }

  const max = HARD_MAX[platform];
  if (max !== null && body.length > max) {
    hard.push({
      id: "H5",
      message: `Body is ${body.length} characters, over the ${platform} limit of ${max}.`,
    });
  }

  if (input.length) {
    const [min, top] = LENGTH_RANGES[platform][input.length];
    const unit = platform === "facebook" ? "words" : "characters";
    const n = platform === "facebook" ? countWords(body) : body.length;
    if (n < min || n > top) {
      hard.push({
        id: "H5-length",
        message: `Body is ${n} ${unit}, outside the ${input.length} range of ${min} to ${top} ${unit}.`,
      });
    }
  }

  if (input.softWarnings !== false) {
    const tell = AI_TELLS.find((w) => containsWord(lower, w));
    if (tell) {
      soft.push({ id: "S1", message: `AI-tell word or phrase: "${tell}".` });
    }

    const hook = input.hook ?? body.split("\n")[0] ?? "";
    const hookLimit = HOOK_LIMIT[platform];
    if (hookLimit !== null && hook.length > hookLimit) {
      soft.push({
        id: "S2",
        message: `Hook is ${hook.length} characters, over the visible limit of ${hookLimit}.`,
      });
    } else if (platform === "facebook" && input.hook && /\r?\n/.test(input.hook.trim())) {
      soft.push({ id: "S2", message: "Facebook hook should be a single first line." });
    }

    const questions = (body.match(/\?/g) ?? []).length;
    if (questions > 1 || (input.questionCount ?? 0) > 1) {
      soft.push({
        id: "S3",
        message: `More than one question (${Math.max(questions, input.questionCount ?? 0)}).`,
      });
    }

    const limit = HASHTAG_LIMIT[platform];
    const tagCount = input.hashtags ? input.hashtags.length : (body.match(/(^|\s)#\w+/g) ?? []).length;
    if (tagCount > limit) {
      soft.push({
        id: "S4",
        message: `${tagCount} hashtags, over the ${platform} limit of ${limit}.`,
      });
    }

    if (input.reviewRequired) {
      soft.push({ id: "S5", message: "Review required: confirm no named person or employer before export." });
    }

    if (/\d/.test(body) && !hasSource(body)) {
      soft.push({ id: "S6", message: "Number or stat in the post with no source noted." });
    }
  }

  return { hard, soft, passed: hard.length === 0 };
}
