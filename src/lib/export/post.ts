import { promises as fs } from "node:fs";
import { lintText } from "../linter";
import type { PostFrontmatter } from "../schemas/post";
import { resolveContentPath } from "../store/paths";
import { readPost, StoreError } from "../store/posts";
import { ExportError } from "./errors";
import { markPostExported } from "./status";

export type PostDoc = { frontmatter: PostFrontmatter; body: string };
export type PostExport = { filename: string; markdown: string };

const TRAILER_LINE = /^(hashtags|alt text)\s*:/i;
const HASHTAG = /#[\p{L}\p{N}_]+/gu;

// Checks a post path is inside content/, ends in .md, and is not a raw copy.
export function assertPostPath(postRelPath: string): void {
  if (typeof postRelPath !== "string" || !postRelPath.endsWith(".md") || postRelPath.endsWith(".raw.md")) {
    throw new ExportError("bad_path", "Post path must end in .md and must not be a raw copy.");
  }
  try {
    resolveContentPath(postRelPath);
  } catch {
    throw new ExportError("bad_path", "Post path must be inside content/.");
  }
}

// Reads and checks a post. Missing files and bad frontmatter become export errors with no file paths.
export async function loadPost(postRelPath: string): Promise<PostDoc> {
  assertPostPath(postRelPath);
  try {
    await fs.access(resolveContentPath(postRelPath));
  } catch {
    throw new ExportError("not_found", `Post not found: ${postRelPath}`);
  }
  try {
    return await readPost(postRelPath);
  } catch (err) {
    if (err instanceof StoreError) throw new ExportError("invalid_post", err.message);
    throw err;
  }
}

// Fresh lint on the full body. Stored lint data is never trusted for the export gate.
export function freshLint(doc: PostDoc): { hard: string[]; soft: string[] } {
  return lintText(doc.body, {
    channel: doc.frontmatter.channel,
    topic: doc.frontmatter.topic,
    reviewRequired: doc.frontmatter.review_required,
  });
}

// Splits the trailing "Hashtags:" and "Alt text:" lines off the body so they are not written twice.
export function splitTrailer(body: string): { caption: string; hashtagLine: string | null; altLines: string[] } {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const trailer: string[] = [];
  let end = lines.length;
  while (end > 0) {
    const line = lines[end - 1].trim();
    if (line === "") {
      end -= 1;
      continue;
    }
    if (!TRAILER_LINE.test(line)) break;
    trailer.unshift(line);
    end -= 1;
  }
  const caption = lines.slice(0, end).join("\n").trim();
  const hashtagLine = trailer.find((l) => /^hashtags\s*:/i.test(l)) ?? null;
  const altLines = trailer
    .filter((l) => /^alt text\s*:/i.test(l))
    .map((l) => l.replace(/^alt text\s*:/i, "").trim())
    .filter((l) => l !== "");
  return { caption, hashtagLine, altLines };
}

function hashtagsIn(text: string): string[] {
  return text.match(HASHTAG) ?? [];
}

// Alt text for a carousel post lives in renders/<channel>/alt.txt beside its deck (doc 03 section 7).
async function deckAltLines(postRelPath: string, channel: string): Promise<string[]> {
  const day = postRelPath.match(/^(.*\/days\/\d{4}-\d{2}-\d{2})\//);
  if (!day) return [];
  const deckRel = `${day[1]}/${channel}-deck.json`;
  const altRel = `${day[1]}/renders/${channel}/alt.txt`;
  if (!(await exists(deckRel)) || !(await exists(altRel))) return [];
  const raw = await fs.readFile(resolveContentPath(altRel), "utf8");
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
}

async function exists(relPath: string): Promise<boolean> {
  try {
    await fs.access(resolveContentPath(relPath));
    return true;
  } catch {
    return false;
  }
}

// File name is <channel>-<date>.md. The date comes from the day folder, else from the created date.
export function exportFilename(postRelPath: string, frontmatter: PostFrontmatter): string {
  const fromPath = postRelPath.match(/\/days\/(\d{4}-\d{2}-\d{2})\//);
  const date = fromPath ? fromPath[1] : frontmatter.created.slice(0, 10);
  return `${frontmatter.channel}-${date}.md`;
}

// Exports one post. Refuses on hard lint failures and on a missing review tick. On success it marks the post exported.
export async function exportPost(
  postRelPath: string,
  opts: { reviewConfirmed: boolean },
): Promise<PostExport> {
  const doc = await loadPost(postRelPath);
  const lint = freshLint(doc);
  if (lint.hard.length > 0) {
    throw new ExportError("hard_lint_failed", `Post has ${lint.hard.length} hard lint failure(s) and cannot be exported yet.`);
  }
  if (doc.frontmatter.review_required && !opts.reviewConfirmed) {
    throw new ExportError("review_required", "This post needs a review tick before export.");
  }

  const { caption, hashtagLine, altLines } = splitTrailer(doc.body);
  const tags = hashtagLine ? hashtagsIn(hashtagLine) : hashtagsIn(caption);
  const alts = altLines.length > 0 ? altLines : await deckAltLines(postRelPath, doc.frontmatter.channel);

  const lines = [caption, "", `Hashtags: ${tags.length > 0 ? tags.join(" ") : "none"}`];
  for (const alt of alts) lines.push(`Alt text: ${alt}`);
  const markdown = `${lines.join("\n")}\n`;

  await markPostExported(postRelPath);
  return { filename: exportFilename(postRelPath, doc.frontmatter), markdown };
}
