// POST /api/week/adapt: adapts all posts of a Week from its pillar. Local only.
import { requireLocal } from "../../../../lib/security/guard";
import { readJsonBody } from "../../../../lib/pipeline/daily/http";
import { parseRequest } from "../../../../lib/pipeline/daily/requests";
import { adaptWeek } from "../../../../lib/pipeline/week/adapt";
import { weekErrorResponse } from "../../../../lib/pipeline/week/errors";
import { WeekPathRequest } from "../../../../lib/pipeline/week/requests";

export async function POST(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const input = parseRequest(WeekPathRequest, await readJsonBody(request));
    return Response.json(await adaptWeek(input));
  } catch (err) {
    return weekErrorResponse(err);
  }
}
