import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PostFrontmatterSchema, type PostFrontmatter } from "../schemas/post";
import { readMarkdown, writeMarkdown } from "./markdown";
import { resolveContentPath } from "./paths";

export type StoreErrorCode = "user_edited" | "invalid_post" | "exists" | "bad_path";

export class StoreError extends Error {
  readonly code: StoreErrorCode;
  constructor(code: StoreErrorCode, message: string) {
    super(message);
    this.name = "StoreError";
    this.code = code;
  }
}

export type PostDoc = { frontmatter: PostFrontmatter; body: string };

// Trims stray line endings and surrounding blank lines so the body hashes the same after a save and reload.
export function normaliseBody(body: string): string {
  const trimmed = body.replace(/\r\n?/g, "\n").trim();
  return trimmed === "" ? "" : `${trimmed}\n`;
}

// sha256 of the normalised body, as hex (ADR 0007).
export function hashBody(body: string): string {
  return createHash("sha256").update(normaliseBody(body), "utf8").digest("hex");
}

// Local time with offset, e.g. 2026-11-24T09:00:00.000+05:30.
export function localIsoWithOffset(d: Date = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const offsetMinutes = -d.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

function summariseIssues(issues: { path: PropertyKey[]; message: string }[]): string {
  return issues.map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`).join("; ");
}

function assertPostPath(postRelPath: string): void {
  if (typeof postRelPath !== "string" || !postRelPath.endsWith(".md") || postRelPath.endsWith(".raw.md")) {
    throw new StoreError("bad_path", `Post path must end in .md (and not .raw.md): ${postRelPath}`);
  }
}

// Creates a post file. Refuses to overwrite an existing file, because content/ is user data.
export async function writePost(
  postRelPath: string,
  frontmatter: unknown,
  body: string,
): Promise<void> {
  assertPostPath(postRelPath);
  const normalised = normaliseBody(body);
  const parsed = PostFrontmatterSchema.safeParse({
    ...(frontmatter as object),
    body_hash: hashBody(normalised),
  });
  if (!parsed.success) {
    throw new StoreError("invalid_post", `Post frontmatter is invalid: ${summariseIssues(parsed.error.issues)}`);
  }
  const file = resolveContentPath(postRelPath);
  if (await exists(file)) {
    throw new StoreError("exists", `Post already exists and will not be overwritten: ${postRelPath}`);
  }
  await writeMarkdown(postRelPath, { data: parsed.data, body: normalised });
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

// Reads a post and checks its frontmatter. Throws a clear error if it is invalid.
export async function readPost(postRelPath: string): Promise<PostDoc> {
  const doc = await readMarkdown(postRelPath);
  const parsed = PostFrontmatterSchema.safeParse(doc.data);
  if (!parsed.success) {
    throw new StoreError("invalid_post", `Post ${postRelPath} has invalid frontmatter: ${summariseIssues(parsed.error.issues)}`);
  }
  return { frontmatter: parsed.data, body: doc.body };
}

// Saves the raw humanise text beside the post as <channel>.raw.md. Never overwrites an existing raw copy.
export async function writeRaw(postRelPath: string, rawBody: string): Promise<string> {
  assertPostPath(postRelPath);
  const rawRel = postRelPath.slice(0, -".md".length) + ".raw.md";
  const file = resolveContentPath(rawRel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.writeFile(file, rawBody, { encoding: "utf8", flag: "wx" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new StoreError("exists", `Raw copy already exists and will not be overwritten: ${rawRel}`);
    }
    throw err;
  }
  return rawRel;
}

// True when the body no longer matches the hash the app last wrote. No hash counts as edited (safe default).
export async function isUserEdited(postRelPath: string): Promise<boolean> {
  const { frontmatter, body } = await readPost(postRelPath);
  if (!frontmatter.body_hash) return true;
  return hashBody(body) !== frontmatter.body_hash;
}

// Copies the current body to versions/<channel>-version-<timestamp>.md. Returns the new path.
export async function saveVersion(postRelPath: string): Promise<string> {
  assertPostPath(postRelPath);
  const { body } = await readMarkdown(postRelPath);
  const channel = path.basename(postRelPath, ".md");
  // Colons are not allowed in Windows file names, so they become hyphens.
  const stamp = localIsoWithOffset().replace(/:/g, "-");
  const versionRel = path.join(path.dirname(postRelPath), "versions", `${channel}-version-${stamp}.md`);
  const file = resolveContentPath(versionRel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body, { encoding: "utf8", flag: "wx" });
  return versionRel;
}

// Replaces the generated body. A user-edited post is refused unless force is set.
// The previous body is always saved to versions/ first, and no file is deleted.
export async function replaceGeneratedBody(
  postRelPath: string,
  newBody: string,
  opts: { force?: boolean } = {},
): Promise<{ versionPath: string }> {
  const { frontmatter, body } = await readPost(postRelPath);
  const edited = !frontmatter.body_hash || hashBody(body) !== frontmatter.body_hash;
  if (edited && !opts.force) {
    throw new StoreError("user_edited", `Post was edited by the user and was not changed: ${postRelPath}`);
  }
  const versionPath = await saveVersion(postRelPath);
  const normalised = normaliseBody(newBody);
  await writeMarkdown(postRelPath, {
    data: { ...frontmatter, body_hash: hashBody(normalised) },
    body: normalised,
  });
  return { versionPath };
}

async function setStale(postRelPath: string, stale: boolean): Promise<void> {
  const { frontmatter, body } = await readPost(postRelPath);
  await writeMarkdown(postRelPath, { data: { ...frontmatter, stale }, body });
}

export function markStale(postRelPath: string): Promise<void> {
  return setStale(postRelPath, true);
}

export function clearStale(postRelPath: string): Promise<void> {
  return setStale(postRelPath, false);
}
