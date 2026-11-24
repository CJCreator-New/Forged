import { promises as fs } from "node:fs";
import path from "node:path";
import { ZipArchive } from "archiver";
import { assertWeekId, WEEKS_DIR } from "../store/weeks";
import { resolveContentPath } from "../store/paths";
import { ExportError } from "./errors";
import { freshLint, loadPost, type PostDoc } from "./post";

// Week ZIP (decision: everything is included, each item marked with its status).
// It holds every file in the week folder, plus README.md. Items that cannot be exported yet are listed, not dropped.

export type WeekFile = { name: string; abs: string };
export type WeekPlan = { readme: string; files: WeekFile[] };

type PostRow = {
  rel: string;
  doc: PostDoc | null;
  hardFailures: number;
  reviewTickMissing: boolean;
};

const DAY_POST = /^days\/\d{4}-\d{2}-\d{2}\/(?:variants\/)?[^/]+\.md$/;
const DAY_DECK = /^days\/\d{4}-\d{2}-\d{2}\/[^/]+-deck\.json$/;
const DAY_RENDER = /^days\/\d{4}-\d{2}-\d{2}\/renders\//;

// Lists every file under a folder as posix paths relative to it, sorted.
async function listFiles(absDir: string, prefix = ""): Promise<string[]> {
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await listFiles(path.join(absDir, entry.name), rel)));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out.sort();
}

function postLine(row: PostRow): string {
  if (!row.doc) return `- ${row.rel}: could not be read (bad frontmatter). Included as it is.`;
  const fm = row.doc.frontmatter;
  const parts = [
    `channel ${fm.channel}`,
    `status ${row.hardFailures > 0 ? "draft (not exportable yet)" : fm.status}`,
    `stale: ${fm.stale ? "yes" : "no"}`,
    `review needed: ${fm.review_required ? "yes" : "no"}`,
    `review tick missing: ${row.reviewTickMissing ? "yes" : "no"}`,
    `lint hard failures: ${row.hardFailures}`,
  ];
  return `- ${row.rel}: ${parts.join(", ")}`;
}

function deckLine(rel: string, post: PostRow | undefined): string {
  if (!post || !post.doc) return `- ${rel}: no matching post file, so no status is shown.`;
  const fm = post.doc.frontmatter;
  const status = post.hardFailures > 0 ? "draft (not exportable yet)" : fm.status;
  return `- ${rel}: channel ${fm.channel}, status ${status}, stale: ${fm.stale ? "yes" : "no"}, review tick missing: ${post.reviewTickMissing ? "yes" : "no"}`;
}

function buildReadme(weekId: string, posts: PostRow[], decks: string[], renders: string[], others: string[]): string {
  const readable = posts.filter((p) => p.doc);
  const notExportable = readable.filter((p) => p.hardFailures > 0).length;
  const stale = readable.filter((p) => p.doc?.frontmatter.stale).length;
  const tickMissing = readable.filter((p) => p.reviewTickMissing).length;
  const lines = [
    `# Week ${weekId}`,
    "",
    "This export holds everything in the week folder. Items are marked with their status. Nothing is hidden.",
    "",
    "## Summary",
    "",
    `- Post files: ${posts.length}`,
    `- Post files not exportable yet (hard lint failures, shown as draft): ${notExportable}`,
    `- Stale posts (the Pillar changed, so the text may be out of date): ${stale}`,
    `- Posts still missing a review tick: ${tickMissing}`,
    `- Deck files: ${decks.length}`,
    `- Render files: ${renders.length}`,
    `- Other files: ${others.length}`,
    "",
    "## Post files",
    "",
    ...(posts.length > 0 ? posts.map(postLine) : ["- None."]),
    "",
    "## Deck files",
    "",
    ...(decks.length > 0
      ? decks.map((rel) => {
          const channel = path.posix.basename(rel).replace(/-deck\.json$/, "");
          const dayDir = path.posix.dirname(rel);
          const match = posts.find((p) => p.rel === `${dayDir}/${channel}.md`);
          return deckLine(rel, match);
        })
      : ["- None."]),
    "",
    "## Render files",
    "",
    ...(renders.length > 0 ? renders.map((rel) => `- ${rel}`) : ["- None."]),
    "",
    "## Other files",
    "",
    ...(others.length > 0 ? others.map((rel) => `- ${rel}`) : ["- None."]),
    "",
  ];
  return lines.join("\n");
}

// Plans the week ZIP: the file list and the README text. Does no zipping, so it can be tested alone.
// base is the folder that holds weeks, relative to content/. Tests pass a temporary one.
export async function planWeek(weekId: string, base: string = WEEKS_DIR): Promise<WeekPlan> {
  try {
    assertWeekId(weekId);
  } catch {
    throw new ExportError("bad_week", "Week must look like 2026-W48.");
  }
  const weekRel = path.posix.join(base, weekId);
  const weekAbs = resolveContentPath(weekRel);
  let names: string[];
  try {
    names = await listFiles(weekAbs);
  } catch {
    throw new ExportError("not_found", `Week not found: ${weekId}`);
  }

  const posts: PostRow[] = [];
  const decks: string[] = [];
  const renders: string[] = [];
  const others: string[] = [];

  for (const rel of names) {
    if (DAY_RENDER.test(rel)) {
      renders.push(rel);
    } else if (DAY_DECK.test(rel)) {
      decks.push(rel);
    } else if (DAY_POST.test(rel) && !rel.endsWith(".raw.md")) {
      const postRel = path.posix.join(weekRel, rel);
      try {
        const doc = await loadPost(postRel);
        const lint = freshLint(doc);
        posts.push({
          rel,
          doc,
          hardFailures: lint.hard.length,
          reviewTickMissing: doc.frontmatter.review_required && doc.frontmatter.status === "draft",
        });
      } catch {
        posts.push({ rel, doc: null, hardFailures: 0, reviewTickMissing: false });
      }
    } else {
      others.push(rel);
    }
  }

  const readme = buildReadme(weekId, posts, decks, renders, others);
  const files: WeekFile[] = names.map((rel) => ({
    name: rel,
    abs: resolveContentPath(path.posix.join(weekRel, rel)),
  }));
  return { readme, files };
}

// Streams the ZIP. The caller turns the returned stream into a Response body.
export function packWeek(plan: WeekPlan): ZipArchive {
  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.append(plan.readme, { name: "README.md" });
  for (const file of plan.files) {
    archive.file(file.abs, { name: file.name });
  }
  void archive.finalize();
  return archive;
}
