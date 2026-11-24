import { LogRowSchema, type LogRow } from "../../lib/schemas/log";

// Reads and writes the log table inside content/log.md. Pure: no file access here.
// Cells are escaped so a "|" typed into a topic cannot break the table.

export const LOG_COLUMNS = [
  "date",
  "post_id",
  "channel",
  "topic",
  "format",
  "length",
  "variant",
  "minutes",
  "edit_rating",
  "reach",
  "followers",
] as const;

export const HEADER_LINE = `| ${LOG_COLUMNS.join(" | ")} |`;
const SEPARATOR_LINE = `| ${LOG_COLUMNS.map(() => "---").join(" | ")} |`;

export class LogFormatError extends Error {
  readonly code = "bad_log" as const;
  constructor(message: string) {
    super(message);
    this.name = "LogFormatError";
  }
}

function escapeCell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
}

function unescapeCell(cell: string): string {
  return cell.replace(/\\(.)/g, "$1");
}

// Splits one table line into cells, honouring escaped pipes.
function splitRow(line: string): string[] {
  const text = line.trim();
  const cells: string[] = [];
  let current = "";
  for (let i = 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < text.length) {
      current += ch + text[i + 1];
      i++;
      continue;
    }
    if (ch === "|") {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim() !== "") cells.push(current);
  return cells.map((cell) => unescapeCell(cell.trim()));
}

function cellText(value: string | number | null): string {
  return value === null ? "" : String(value);
}

export function formatLogRow(row: LogRow): string {
  const values: (string | number | null)[] = [
    row.date,
    row.post_id,
    row.channel,
    row.topic,
    row.format,
    row.length,
    row.variant,
    row.minutes,
    row.edit_rating,
    row.reach,
    row.followers,
  ];
  return `| ${values.map((value) => escapeCell(cellText(value))).join(" | ")} |`;
}

function optionalNumber(cell: string): number | null {
  return cell === "" ? null : Number(cell);
}

function toRow(cells: string[], lineNo: number): LogRow {
  if (cells.length !== LOG_COLUMNS.length) {
    throw new LogFormatError(
      `Row on line ${lineNo} has ${cells.length} columns, expected ${LOG_COLUMNS.length}.`,
    );
  }
  const [date, postId, channel, topic, format, length, variant, minutes, editRating, reach, followers] = cells;
  const parsed = LogRowSchema.safeParse({
    date,
    post_id: postId,
    channel,
    topic,
    format,
    length,
    variant: Number(variant),
    minutes: optionalNumber(minutes),
    edit_rating: editRating === "" ? null : editRating,
    reach: optionalNumber(reach),
    followers: optionalNumber(followers),
  });
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ");
    throw new LogFormatError(`Row on line ${lineNo} is not valid: ${problems}`);
  }
  return parsed.data;
}

function findTable(lines: string[]): { start: number; end: number } | null {
  const start = lines.findIndex((line) => line.trim() === HEADER_LINE);
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && lines[end].trim().startsWith("|")) end++;
  return { start, end };
}

// Returns every row in the log table, in file order. A body with no log table has no rows.
export function parseLogTable(body: string): LogRow[] {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const range = findTable(lines);
  if (!range) return [];
  if (!/^\|\s*-{3,}/.test(lines[range.start + 1].trim())) {
    throw new LogFormatError("The log table is missing its divider line under the header.");
  }
  const rows: LogRow[] = [];
  for (let i = range.start + 2; i < range.end; i++) {
    rows.push(toRow(splitRow(lines[i]), i + 1));
  }
  return rows;
}

// Replaces the log table in the body with the given rows. Text around the table is kept as it was.
export function replaceLogTable(body: string, rows: LogRow[]): string {
  const normalised = body.replace(/\r\n?/g, "\n");
  const lines = normalised.split("\n");
  const table = [HEADER_LINE, SEPARATOR_LINE, ...rows.map(formatLogRow)];
  const range = findTable(lines);
  if (range) {
    lines.splice(range.start, range.end - range.start, ...table);
    return lines.join("\n");
  }
  const head = normalised.replace(/\s+$/, "");
  return `${head === "" ? "" : `${head}\n\n`}${table.join("\n")}\n`;
}
