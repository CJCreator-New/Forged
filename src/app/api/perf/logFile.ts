import type { LogRow } from "../../../lib/schemas/log";
import { readMarkdown, writeMarkdown } from "../../../lib/store/markdown";
import { parseLogTable, replaceLogTable } from "../../../components/performance/logTable";
import { LOG_PATH } from "./logPath";

const NEW_LOG_BODY = "# Performance log\n\nOne row per post. Reach and follower numbers are entered by hand.\n";

function isMissingFile(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "ENOENT";
}

// A missing log is an empty log. Nothing is created until the first save.
export async function readLogRows(relPath: string = LOG_PATH): Promise<LogRow[]> {
  try {
    const doc = await readMarkdown(relPath);
    return parseLogTable(doc.body);
  } catch (err) {
    if (isMissingFile(err)) return [];
    throw err;
  }
}

// Writes the table back and keeps the frontmatter and any text outside the table.
export async function saveLogRows(rows: LogRow[], relPath: string = LOG_PATH): Promise<void> {
  let data: Record<string, unknown> = {};
  let body = NEW_LOG_BODY;
  try {
    const doc = await readMarkdown(relPath);
    data = doc.data;
    body = doc.body;
  } catch (err) {
    if (!isMissingFile(err)) throw err;
  }
  await writeMarkdown(relPath, { data, body: replaceLogTable(body, rows) });
}
