import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { resolveContentPath } from "./paths";

export type MarkdownDoc = { data: Record<string, unknown>; body: string };

// Reads a markdown file under content/ and splits its YAML frontmatter from the body.
export async function readMarkdown(relativePath: string): Promise<MarkdownDoc> {
  const file = resolveContentPath(relativePath);
  const raw = await fs.readFile(file, "utf8");
  const parsed = matter(raw);
  return { data: parsed.data, body: parsed.content };
}

// Writes a markdown file under content/ with YAML frontmatter. Creates folders as needed.
export async function writeMarkdown(relativePath: string, doc: MarkdownDoc): Promise<void> {
  const file = resolveContentPath(relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const out = matter.stringify(doc.body, doc.data);
  await fs.writeFile(file, out, "utf8");
}
