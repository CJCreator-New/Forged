import { promises as fs } from "node:fs";
import path from "node:path";
import type { LintResult } from "../../linter";
import { writeMarkdown } from "../../store/markdown";
import { resolveContentPath } from "../../store/paths";
import {
  isUserEdited,
  localIsoWithOffset,
  normaliseBody,
  readPost,
  StoreError,
  writeRaw,
} from "../../store/posts";
import type { PostFrontmatter } from "../../schemas/post";
import { DailyError } from "./errors";

export async function fileExists(relPath: string): Promise<boolean> {
  try {
    await fs.access(resolveContentPath(relPath));
    return true;
  } catch {
    return false;
  }
}

// Saves the pre-humanise text beside a post as <channel>.raw.md. If that name is taken (a regenerated post),
// the copy goes to versions/ with a timestamp. Nothing is overwritten.
export async function writeRawSafe(postRelPath: string, rawBody: string): Promise<string> {
  try {
    return await writeRaw(postRelPath, rawBody);
  } catch (err) {
    if (!(err instanceof StoreError) || err.code !== "exists") throw err;
  }
  const base = path.posix.basename(postRelPath, ".md");
  const stamp = localIsoWithOffset().replace(/:/g, "-");
  const rel = path.posix.join(path.posix.dirname(postRelPath), "versions", `${base}-raw-${stamp}.md`);
  await writeMarkdown(rel, { data: {}, body: normaliseBody(rawBody) });
  return rel;
}

// Changes some frontmatter fields and keeps the body and its hash exactly as they are.
export async function updatePostFields(
  postRelPath: string,
  patch: Partial<PostFrontmatter>,
  removeKeys: (keyof PostFrontmatter)[] = [],
): Promise<void> {
  const { frontmatter, body } = await readPost(postRelPath);
  const next: Record<string, unknown> = { ...frontmatter, ...patch };
  for (const key of removeKeys) delete next[key];
  await writeMarkdown(postRelPath, { data: next, body: normaliseBody(body) });
}

// Lint results go back to the UI. The soft list is hidden when the linter_soft_warnings switch is off.
export function presentLint(lint: LintResult, softWarnings: boolean): LintResult {
  return { hard: lint.hard, soft: softWarnings ? lint.soft : [] };
}

// Generated text never overwrites a user edit (ADR 0007). Checked before any model call.
export async function ensurePostNotEdited(postRelPath: string): Promise<void> {
  if (await isUserEdited(postRelPath)) {
    throw new DailyError(
      "user_edited",
      "You edited this post, so the generated text was not changed. Copy your version somewhere safe first, or start a fresh post.",
    );
  }
}

export function dayFolder(postRelPath: string): string {
  return path.posix.dirname(postRelPath);
}
