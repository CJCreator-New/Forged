// GET /api/week/view?week=YYYY-Www: read only view of one Week. Local only.
import { requireLocal } from "../../../../lib/security/guard";
import { weekErrorResponse } from "../../../../lib/pipeline/week/errors";
import { viewWeek } from "../../../../lib/pipeline/week/view";

export async function GET(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const week = new URL(request.url).searchParams.get("week") ?? "";
    return Response.json(await viewWeek(week));
  } catch (err) {
    return weekErrorResponse(err);
  }
}
