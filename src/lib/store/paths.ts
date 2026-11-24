import path from "node:path";

// All user data lives under content/. Nothing outside it is read or written by the store.
export const CONTENT_ROOT = path.resolve(process.cwd(), "content");

// Turns a relative path (such as "ideas/2026-11-24-ai.md") into an absolute path inside content/.
// Throws if the path resolves anywhere outside content/, including via "../" or an absolute path.
export function resolveContentPath(relativePath: string): string {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new Error("Path must be a non-empty string.");
  }
  if (relativePath.includes("\0")) {
    throw new Error("Path contains an invalid character.");
  }
  const absolute = path.resolve(CONTENT_ROOT, relativePath);
  const rel = path.relative(CONTENT_ROOT, absolute);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path is outside content/: ${relativePath}`);
  }
  return absolute;
}
