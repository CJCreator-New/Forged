// POST /api/week: creates a Week from a brief (seven Day folders and brief.md). Local only.
import { requireLocal } from "../../../lib/security/guard";
import { readJsonBody } from "../../../lib/pipeline/daily/http";
import { parseRequest } from "../../../lib/pipeline/daily/requests";
import { createWeekFromBrief } from "../../../lib/pipeline/week/create";
import { weekErrorResponse } from "../../../lib/pipeline/week/errors";
import { CreateWeekRequest } from "../../../lib/pipeline/week/requests";

export async function POST(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const input = parseRequest(CreateWeekRequest, await readJsonBody(request));
    return Response.json(await createWeekFromBrief(input));
  } catch (err) {
    return weekErrorResponse(err);
  }
}
