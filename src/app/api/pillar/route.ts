// POST /api/pillar: writes the Pillar for a Week. PUT /api/pillar: saves the edited Pillar and marks posts stale.
// Local only. Post bodies are never changed here.
import { requireLocal } from "../../../lib/security/guard";
import { readJsonBody } from "../../../lib/pipeline/daily/http";
import { parseRequest } from "../../../lib/pipeline/daily/requests";
import { generatePillar, readPillarForWeek, savePillar } from "../../../lib/pipeline/week/pillar";
import { weekErrorResponse } from "../../../lib/pipeline/week/errors";
import { PillarCreateRequest, PillarUpdateRequest } from "../../../lib/pipeline/week/requests";

// GET /api/pillar?week=<weekId>: returns { body } for the Week's Pillar, or 404 pillar_not_found.
export async function GET(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const week = new URL(request.url).searchParams.get("week") ?? "";
    return Response.json({ body: await readPillarForWeek(week) });
  } catch (err) {
    return weekErrorResponse(err);
  }
}

export async function POST(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const input = parseRequest(PillarCreateRequest, await readJsonBody(request));
    return Response.json(await generatePillar(input));
  } catch (err) {
    return weekErrorResponse(err);
  }
}

export async function PUT(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const input = parseRequest(PillarUpdateRequest, await readJsonBody(request));
    return Response.json(await savePillar(input));
  } catch (err) {
    return weekErrorResponse(err);
  }
}
