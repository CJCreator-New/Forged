// Pure helpers for the Week page. No React here, so they can be tested directly.
import type { ApiError, ChannelId, LintCounts, ViewDay, ViewPost } from "./types";

export const CHANNEL_ORDER: ChannelId[] = ["linkedin", "instagram", "facebook"];

export const CHANNEL_NAME: Record<ChannelId, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
};

export const SOURCE_MARKER = "[SOURCE NEEDED]";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_ID_PATTERN = /^(\d{4})-W(\d{2})$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" });
const MONTH_FORMAT = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" });

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// Reads YYYY-MM-DD as a UTC timestamp. Returns null for text that is not a real calendar date.
function parseDate(value: string): number | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return ms;
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// Monday = 0 ... Sunday = 6. Works on UTC timestamps, so the local offset never shifts the day.
function isoWeekday(ms: number): number {
  return (new Date(ms).getUTCDay() + 6) % 7;
}

// The ISO week id (for example 2026-W48) of a YYYY-MM-DD date. Null when the date is invalid.
export function isoWeekIdFromDate(date: string): string | null {
  const ms = parseDate(date);
  if (ms === null) return null;
  // The Thursday of the same ISO week decides which year the week belongs to.
  const thursday = ms + (3 - isoWeekday(ms)) * DAY_MS;
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1;
  return `${year}-W${pad(week)}`;
}

// The Monday (YYYY-MM-DD) that starts an ISO week id. Null when the id is not a real week.
export function mondayOfWeek(weekId: string): string | null {
  const match = WEEK_ID_PATTERN.exec(weekId);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  const jan4 = Date.UTC(year, 0, 4);
  const monday = jan4 - isoWeekday(jan4) * DAY_MS + (week - 1) * 7 * DAY_MS;
  const monthDay = formatDate(monday);
  // Rejects week 53 in years that only have 52 weeks.
  if (isoWeekIdFromDate(monthDay) !== weekId) return null;
  return monthDay;
}

// The seven dates (Monday to Sunday) of an ISO week id. Empty when the id is invalid.
export function weekDates(weekId: string): string[] {
  const monday = mondayOfWeek(weekId);
  if (monday === null) return [];
  const start = parseDate(monday);
  if (start === null) return [];
  return Array.from({ length: 7 }, (_, index) => formatDate(start + index * DAY_MS));
}

// The ISO week id for the user's own calendar day, read from local date parts.
export function currentWeekId(now: Date): string {
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return isoWeekIdFromDate(today) ?? "";
}

// The folder that holds a week, relative to content/.
export function weekPathFor(weekId: string): string {
  return `weeks/${weekId}`;
}

export type DayHeading = {
  weekday: string;
  dayNumber: number;
  month: string;
};

export function dayHeading(date: string): DayHeading | null {
  const ms = parseDate(date);
  if (ms === null) return null;
  return {
    weekday: WEEKDAY_FORMAT.format(ms),
    dayNumber: new Date(ms).getUTCDate(),
    month: MONTH_FORMAT.format(ms),
  };
}

// Replaces em dashes and en dashes, so no visible text carries them.
export function sanitizeText(text: string): string {
  return text.replace(/\s*[\u2014\u2013]\s*/g, ", ").trim();
}

// A server message is shown only when it reads as a sentence.
export function usableMessage(message: string | undefined): string {
  if (!message) return "";
  const cleaned = sanitizeText(message);
  if (cleaned.startsWith("{") || cleaned.startsWith("[")) return "";
  return cleaned;
}

export type StatusLabel = "Draft" | "Reviewed" | "Rendered" | "Exported" | "Status unknown";

const STATUS_LABELS: Record<string, StatusLabel> = {
  draft: "Draft",
  reviewed: "Reviewed",
  rendered: "Rendered",
  exported: "Exported",
};

export function statusLabel(status: string): StatusLabel {
  return STATUS_LABELS[status] ?? "Status unknown";
}

export function countOf(value: string[] | number): number {
  if (Array.isArray(value)) return value.length;
  return typeof value === "number" && value > 0 ? Math.floor(value) : 0;
}

export type CardBadge = {
  tone: "must-fix" | "stale" | "review";
  label: string;
};

// The badges a card shows, in reading order. Red for hard lint, amber for stale, plain for review.
export function cardBadges(card: { hardCount: number; stale: boolean; reviewRequired: boolean }): CardBadge[] {
  const badges: CardBadge[] = [];
  if (card.hardCount > 0) badges.push({ tone: "must-fix", label: "Must fix" });
  if (card.stale) badges.push({ tone: "stale", label: "Needs a fresh write" });
  if (card.reviewRequired) badges.push({ tone: "review", label: "Review needed" });
  return badges;
}

export type WeekCard = {
  path: string;
  channel: ChannelId;
  status: string;
  statusLabel: StatusLabel;
  stale: boolean;
  hardCount: number;
  softCount: number;
  reviewRequired: boolean;
};

export type WeekSlot = {
  channel: ChannelId;
  cards: WeekCard[];
};

export type WeekColumn = {
  date: string;
  heading: DayHeading | null;
  slots: WeekSlot[];
};

function isChannel(value: string): value is ChannelId {
  return (CHANNEL_ORDER as string[]).includes(value);
}

function toCard(post: ViewPost, channel: ChannelId): WeekCard {
  return {
    path: post.path,
    channel,
    status: post.status,
    statusLabel: statusLabel(post.status),
    stale: post.stale,
    hardCount: countOf(post.lint.hard as LintCounts["hard"]),
    softCount: countOf(post.lint.soft as LintCounts["soft"]),
    reviewRequired: post.review_required === true,
  };
}

// Turns the view response into seven day columns, always Monday to Sunday, each with three channel slots.
// Days or channels the response does not mention still show as empty, so the grid never has gaps.
export function groupWeekDays(weekId: string, days: ViewDay[]): WeekColumn[] {
  return weekDates(weekId).map((date) => {
    const day = days.find((item) => item.date === date);
    const posts = day ? day.posts : [];
    const slots: WeekSlot[] = CHANNEL_ORDER.map((channel) => ({
      channel,
      cards: posts
        .filter((post) => isChannel(post.channel) && post.channel === channel)
        .map((post) => toCard(post, channel)),
    }));
    return { date, heading: dayHeading(date), slots };
  });
}

// Counts the cards in a grouped week, so the page knows when it is empty.
export function countCards(columns: WeekColumn[]): number {
  return columns.reduce(
    (total, column) => total + column.slots.reduce((sum, slot) => sum + slot.cards.length, 0),
    0,
  );
}

// Export is off until there is at least one post to put in the ZIP.
export function exportDisabledReason(cardCount: number): string | null {
  return cardCount > 0 ? null : "Write the week first. The ZIP needs at least one post.";
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

// Splits pillar text into plain and marked pieces. Odd indexes are the markers.
export function highlightSegments(text: string): { text: string; marker: boolean }[] {
  return text
    .split(/(\[SOURCE NEEDED\])/)
    .map((part, index) => ({ text: part, marker: index % 2 === 1 }))
    .filter((segment) => segment.text.length > 0);
}

export function countSourceMarkers(text: string): number {
  return text.split(SOURCE_MARKER).length - 1;
}

export function parseKeyPoints(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export type BriefInput = {
  goal: string;
  audience: string;
  keyPointsText: string;
  callToAction: string;
  link: string;
};

// Returns one plain sentence per problem. An empty list means the brief can be sent.
export function validateBrief(input: BriefInput): string[] {
  const problems: string[] = [];
  if (input.goal.trim() === "") problems.push("Add the goal for the week.");
  if (input.audience.trim() === "") problems.push("Add who the posts are for.");
  if (parseKeyPoints(input.keyPointsText).length === 0) {
    problems.push("Add at least one key point. Put each point on its own line.");
  }
  if (input.callToAction.trim() === "") problems.push("Add the call to action.");
  const link = input.link.trim();
  if (link !== "" && !/^https?:\/\//i.test(link)) {
    problems.push("The link must start with https://");
  }
  return problems;
}

// Summarises the adapt step. Entries marked as skipped were left alone because the user edited them.
export function summariseAdapt(entries: { status: string }[]): { written: number; skipped: number } {
  const skipped = entries.filter((entry) => entry.status === "skipped_user_edited").length;
  return { written: entries.length - skipped, skipped };
}

export function staleMessage(count: number): string {
  if (count === 0) return "Saved. No posts needed a fresh write.";
  if (count === 1) return "Saved. 1 post is marked Needs a fresh write.";
  return `Saved. ${count} posts are marked Needs a fresh write.`;
}

// Folder that holds a day's files, from a post path like weeks/2026-W48/days/2026-11-23/linkedin.md.
export function dayPathOf(postPath: string): string | null {
  const cut = postPath.lastIndexOf("/");
  return cut > 0 ? postPath.slice(0, cut) : null;
}

export type WeekPlainError = {
  title: string;
  detail: string;
  action: "replace_week" | "none";
};

// Turns an API error into plain English. Never shows raw JSON or a key value.
export function plainWeekError(error: ApiError): WeekPlainError {
  const serverMessage = usableMessage(error.message);
  switch (error.code) {
    case "missing_key": {
      const name = error.key ? sanitizeText(error.key) : "a model key";
      return {
        title: "A key is missing",
        detail: `Set ${name} in your local settings file, then restart the app.`,
        action: "none",
      };
    }
    case "voice_missing":
      return {
        title: "Your voice file is missing",
        detail: "Create your voice file at content/voice.md, then try again.",
        action: "none",
      };
    case "week_exists":
      return {
        title: "This week already exists",
        detail: "Replacing it overwrites this week's brief and posts. Only replace it if you want a new week.",
        action: "replace_week",
      };
    case "facts_changed":
      return {
        title: "The new text changed some facts",
        detail: serverMessage || "Check the text before you use it.",
        action: "none",
      };
    case "user_edited":
      return {
        title: "You have edited this post",
        detail: "Writing it again would replace your edits. Copy your edits somewhere safe first.",
        action: "none",
      };
    case "network":
      return { title: "The app is not responding", detail: serverMessage, action: "none" };
    case "http_404":
    case "post_not_found":
      return { title: "Not found", detail: "That file is not in your content folder.", action: "none" };
    default:
      return {
        title: "Something went wrong",
        detail: serverMessage || "Try again. If it keeps happening, check that the app is still running.",
        action: "none",
      };
  }
}
