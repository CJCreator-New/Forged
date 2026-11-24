import { requireLocal } from "@/lib/security/guard";
import { generateIdeas } from "@/lib/pipeline/daily/ideas";
import { errorResponse } from "@/lib/pipeline/daily/errors";
import { readJsonBody } from "@/lib/pipeline/daily/http";
import { IdeasRequest, parseRequest } from "@/lib/pipeline/daily/requests";

export async function POST(request: Request) {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const input = parseRequest(IdeasRequest, await readJsonBody(request));
    const result = await generateIdeas(input);
    return Response.json({
      angles: result.angles,
      idea_file: result.idea_file,
      ...(result.trend_sources ? { trend_sources: result.trend_sources } : {}),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
