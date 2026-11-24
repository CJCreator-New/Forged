import path from "node:path";
import { assertDateISO, assertWeekId } from "../../store/weeks";
import { CONTENT_ROOT } from "../../store/paths";

// Paths are relative to content/, with forward slashes, e.g. weeks/2026-W48/days/2026-11-24/linkedin.md.
const POST_RE = /^weeks\/([^/]+)\/days\/([^/]+)\/(linkedin|instagram|facebook)\.md$/;
const DECK_RE = /^weeks\/([^/]+)\/days\/([^/]+)\/(linkedin|instagram|facebook)-deck\.json$/;

export type Channel = "linkedin" | "instagram" | "facebook";

function validIds(weekId: string, dateISO: string): boolean {
  try {
    assertWeekId(weekId);
    assertDateISO(dateISO);
    return true;
  } catch {
    return false;
  }
}

export function parsePostPath(postRel: string): { channel: Channel; dayRel: string; weekRel: string } | null {
  const match = POST_RE.exec(postRel);
  if (!match || !validIds(match[1], match[2])) return null;
  return {
    channel: match[3] as Channel,
    dayRel: path.posix.join("weeks", match[1], "days", match[2]),
    weekRel: path.posix.join("weeks", match[1]),
  };
}

export function parseDeckPath(deckRel: string): { channel: Channel; dayRel: string } | null {
  const match = DECK_RE.exec(deckRel);
  if (!match || !validIds(match[1], match[2])) return null;
  return { channel: match[3] as Channel, dayRel: path.posix.join("weeks", match[1], "days", match[2]) };
}

export function deckRelFor(dayRel: string, channel: Channel): string {
  return `${dayRel}/${channel}-deck.json`;
}

// Each channel renders into its own folder, so two decks in one day never overwrite each other.
export function rendersRelFor(dayRel: string, channel: Channel): string {
  return `${dayRel}/renders/${channel}`;
}

// Turns an absolute path inside content/ into a content-relative path with forward slashes.
export function toContentRel(absolute: string): string {
  return path.relative(CONTENT_ROOT, absolute).split(path.sep).join("/");
}
