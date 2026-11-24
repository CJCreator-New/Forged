import { requireLocal } from "@/lib/security/guard";
import { humanisePost } from "@/lib/pipeline/daily/humanise-post";
import { errorResponse } from "@/lib/pipeline/daily/errors";
import { readJsonBody } from "@/lib/pipeline/daily/http";
import { parseRequest, PostOnlyRequest } from "@/lib/pipeline/daily/requests";

export async function POST(request: Request) {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const input = parseRequest(PostOnlyRequest, await readJsonBody(request));
    const { post_path, raw_path } = await humanisePost(input);
    return Response.json({ post_path, raw_path });
  } catch (err) {
    return errorResponse(err);
  }
}
