import { requireLocal } from "../../../lib/security/guard";
import { readSwitches } from "../../../lib/config/switches";
import { rank, resetPerformance } from "../../../lib/perf/perf";
import { isRecord, perfError, readJsonBody } from "./errors";
import { readLogRows, saveLogRows } from "./logFile";

// Ranking is off in the switch: no rows are read and nothing is computed.
export async function GET(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;

  let loop: ReturnType<typeof readSwitches>["performance_loop"];
  try {
    loop = readSwitches().performance_loop;
  } catch {
    return perfError(500, "invalid_config", "A settings file is not valid. Check the config folder.");
  }
  if (!loop.enabled) return Response.json({ enabled: false });

  try {
    const rows = await readLogRows();
    const result = rank(rows, { threshold: loop.min_posts, minGroup: loop.min_group });
    return Response.json({
      enabled: true,
      logged: result.logged,
      needed: result.needed,
      ranked: result.ranked,
      threshold: loop.min_posts,
      min_group: loop.min_group,
      rows,
    });
  } catch {
    return perfError(500, "bad_log", "The performance log could not be read. Check content/log.md.");
  }
}

// Clears reach and follower numbers on every row. Posts (rows) stay.
export async function DELETE(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;

  const body = await readJsonBody(request);
  if (!isRecord(body) || body.confirm !== true) {
    return perfError(400, "confirm_required", "Confirm before clearing the numbers.");
  }

  try {
    const rows = await readLogRows();
    if (rows.length > 0) await saveLogRows(resetPerformance(rows));
    return Response.json({ cleared: true });
  } catch {
    return perfError(500, "bad_log", "The performance log could not be cleared. Check content/log.md.");
  }
}
