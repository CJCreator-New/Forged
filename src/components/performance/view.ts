import type { LogRow } from "../../lib/schemas/log";

// Plain-English copy and form helpers for the Performance screen. Pure: no fetch, no DOM.

export type Option<T extends string> = { value: T; label: string };

export const CHANNEL_OPTIONS: Option<LogRow["channel"]>[] = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
];

export const FORMAT_OPTIONS: Option<LogRow["format"]>[] = [
  { value: "text", label: "Text" },
  { value: "carousel", label: "Carousel" },
];

export const LENGTH_OPTIONS: Option<LogRow["length"]>[] = [
  { value: "micro", label: "Micro" },
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
  { value: "extended", label: "Extended" },
  { value: "custom", label: "Custom" },
];

export const EDIT_RATING_OPTIONS: Option<NonNullable<LogRow["edit_rating"]>>[] = [
  { value: "as-is", label: "As-is" },
  { value: "light", label: "Light edits" },
  { value: "rewrite", label: "Rewrite" },
];

// Shown when a post has no edit rating (the "Edit rating" field left blank).
export const NOT_RATED = "Not rated";

export function optionLabel<T extends string>(options: Option<T>[], value: T | null): string {
  if (value === null) return NOT_RATED;
  return options.find((option) => option.value === value)?.label ?? value;
}

// "1 more post needed" for one post, otherwise "N more posts needed".
export function thresholdSentence(needed: number): string {
  return needed === 1 ? "1 more post needed" : `${needed} more posts needed`;
}

export function thresholdLine(logged: number, threshold: number, needed: number): string {
  return `Logged ${logged} of ${threshold} posts. ${thresholdSentence(needed)} before the ranking turns on.`;
}

// The ranking scores edits as 3 for As-is, 2 for Light edits and 1 for Rewrite. Turn an average back into words.
export function typicalEditLevel(averageRating: number): string {
  if (averageRating >= 2.5) return "As-is";
  if (averageRating >= 1.5) return "Light edits";
  if (averageRating > 0) return "Rewrite";
  return NOT_RATED;
}

// Progress from 0 to 100, for the thin bar under the threshold line.
export function progressPercent(logged: number, threshold: number): number {
  if (threshold <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((logged / threshold) * 100)));
}

// Reasons come from the ranking as lower-case text. Show them with a capital letter.
export function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Indian digit grouping (1,20,000) for numbers on screen.
export function displayNumber(value: number | null): string {
  if (value === null) return "Not entered";
  return value.toLocaleString("en-IN");
}

// Local date as YYYY-MM-DD, not UTC, so the date matches the user's day.
export function localDateString(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type LogFormState = {
  postId: string;
  date: string;
  channel: LogRow["channel"];
  topic: string;
  format: LogRow["format"];
  length: LogRow["length"];
  variant: string;
  minutes: string;
  editRating: NonNullable<LogRow["edit_rating"]> | "";
  reach: string;
  followers: string;
};

export function emptyLogForm(d: Date = new Date()): LogFormState {
  return {
    postId: "",
    date: localDateString(d),
    channel: "linkedin",
    topic: "",
    format: "text",
    length: "medium",
    variant: "1",
    minutes: "",
    editRating: "",
    reach: "",
    followers: "",
  };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Blank is allowed for an optional number. Anything else must be a number, not negative.
function optionalNumber(text: string, label: string, integer: boolean): { value: number | null } | { error: string } {
  const trimmed = text.trim();
  if (trimmed === "") return { value: null };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) {
    return { error: integer ? `${label} must be a whole number, 0 or more.` : `${label} must be a number, 0 or more.` };
  }
  return { value };
}

// Turns the form into a log row. Returns a plain-English message for the first problem found.
export function buildLogRow(form: LogFormState): { row: LogRow } | { error: string } {
  const postId = form.postId.trim();
  const topic = form.topic.trim();
  if (postId === "") return { error: "Add a post ID." };
  if (!DATE_PATTERN.test(form.date)) return { error: "Pick a date." };
  if (topic === "") return { error: "Add the topic." };

  const variant = Number(form.variant.trim());
  if (!Number.isInteger(variant) || variant < 1) return { error: "Variant must be a whole number, 1 or more." };

  const minutes = optionalNumber(form.minutes, "Minutes", false);
  if ("error" in minutes) return minutes;
  const reach = optionalNumber(form.reach, "Reach", true);
  if ("error" in reach) return reach;
  const followers = optionalNumber(form.followers, "Followers", true);
  if ("error" in followers) return followers;

  return {
    row: {
      date: form.date,
      post_id: postId,
      channel: form.channel,
      topic,
      format: form.format,
      length: form.length,
      variant,
      minutes: minutes.value,
      edit_rating: form.editRating === "" ? null : form.editRating,
      reach: reach.value,
      followers: followers.value,
    },
  };
}

// Reach and followers for an edit on an existing row.
export function buildNumbers(reachText: string, followersText: string): { reach: number | null; followers: number | null } | { error: string } {
  const reach = optionalNumber(reachText, "Reach", true);
  if ("error" in reach) return reach;
  const followers = optionalNumber(followersText, "Followers", true);
  if ("error" in followers) return followers;
  return { reach: reach.value, followers: followers.value };
}

export const RESET_CONFIRM_TEXT = "This clears reach and follower numbers from the log. Your posts are not deleted.";
