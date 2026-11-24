import { promises as fs } from "node:fs";
import matter from "gray-matter";
import { resolveContentPath } from "../store/paths";

// Sets only the status field to "exported". The body and body_hash are kept as they are,
// so an edited post still reads as edited (ADR 0007). Writes stay inside content/.
export async function markPostExported(postRelPath: string): Promise<void> {
  const file = resolveContentPath(postRelPath);
  const raw = await fs.readFile(file, "utf8");
  const parsed = matter(raw);
  if (parsed.data.status === "exported") return;
  const data = { ...parsed.data, status: "exported" };
  await fs.writeFile(file, matter.stringify(parsed.content, data), "utf8");
}
