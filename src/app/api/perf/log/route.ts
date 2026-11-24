import { requireLocal } from "../../../../lib/security/guard";
import { LogRowSchema, type LogRow } from "../../../../lib/schemas/log";
import { isRecord, perfError, readJsonBody } from "../errors";
import { readLogRows, saveLogRows } from "../logFile";

// Columns the user is allowed to change after a row is logged.
const NUMBER_COLUMNS = new Set<keyof LogRow>(["reach", "followers"]);
const FIXED_COLUMNS = (Object.keys(LogRowSchema.shape) as (keyof LogRow)[]).filter((k) => !NUMBER_COLUMNS.has(k));

function sameFixedColumns(a: LogRow, b: LogRow): boolean {
  return FIXED_COLUMNS.every((key) => a[key] === b[key]);
}

// Appends a new row. With replace: true, changes only reach and followers on the row with the same post_id.
export async function POST(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;

  const body = await readJsonBody(request);
  if (!isRecord(body) || !("row" in body)) {
    return perfError(400, "bad_row", "Send the row to log.");
  }

  const parsed = LogRowSchema.safeParse(body.row);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ");
    return perfError(422, "invalid_row", `Check these fields: ${problems}`);
  }
  const row = parsed.data;
  const replace = body.replace === true;

  try {
    const rows = await readLogRows();
    const index = rows.findIndex((existing) => existing.post_id === row.post_id);

    if (replace) {
      if (index === -1) return perfError(404, "post_not_found", "No logged post has that ID.");
      if (!sameFixedColumns(rows[index], row)) {
        return perfError(
          409,
          "row_change_refused",
          "Only reach and follower numbers can be changed here. Other fields stay as they were logged.",
        );
      }
      rows[index] = { ...rows[index], reach: row.reach, followers: row.followers };
      await saveLogRows(rows);
      return Response.json({ replaced: true });
    }

    if (index !== -1) {
      return perfError(409, "duplicate_post_id", "That post ID is already in the log. Use a new ID.");
    }
    rows.push(row);
    await saveLogRows(rows);
    return Response.json({ appended: true });
  } catch {
    return perfError(500, "bad_log", "The performance log could not be saved. Check content/log.md.");
  }
}
