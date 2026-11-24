import { requireLocal } from "@/lib/security/guard";
import { draftPost } from "@/lib/pipeline/daily/draft";
import { errorResponse } from "@/lib/pipeline/daily/errors";
import { readJsonBody } from "@/lib/pipeline/daily/http";
import { DraftRequest, parseRequest } from "@/lib/pipeline/daily/requests";

export async function POST(request: Request) {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const input = parseRequest(DraftRequest, await readJsonBody(request));
    const { post_path, lint } = await draftPost(input);
    return Response.json({ post_path, lint });
  } catch (err) {
    return errorResponse(err);
  }
}
