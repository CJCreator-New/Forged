import { requireLocal } from "@/lib/security/guard";
import { pickAngle } from "@/lib/pipeline/daily/day";
import { errorResponse } from "@/lib/pipeline/daily/errors";
import { readJsonBody } from "@/lib/pipeline/daily/http";
import { parseRequest, PickRequest } from "@/lib/pipeline/daily/requests";

export async function POST(request: Request) {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const input = parseRequest(PickRequest, await readJsonBody(request));
    return Response.json(await pickAngle(input));
  } catch (err) {
    return errorResponse(err);
  }
}
