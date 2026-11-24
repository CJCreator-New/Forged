import { requireLocal } from "@/lib/security/guard";
import { lintPost } from "@/lib/pipeline/daily/lint-post";
import { errorResponse } from "@/lib/pipeline/daily/errors";
import { readJsonBody } from "@/lib/pipeline/daily/http";
import { parseRequest, PostOnlyRequest } from "@/lib/pipeline/daily/requests";

export async function POST(request: Request) {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const input = parseRequest(PostOnlyRequest, await readJsonBody(request));
    return Response.json(await lintPost(input));
  } catch (err) {
    return errorResponse(err);
  }
}
