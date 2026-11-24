import { requireLocal } from "@/lib/security/guard";
import { changeLength } from "@/lib/pipeline/daily/length";
import { errorResponse } from "@/lib/pipeline/daily/errors";
import { readJsonBody } from "@/lib/pipeline/daily/http";
import { LengthRequest, parseRequest } from "@/lib/pipeline/daily/requests";

export async function POST(request: Request) {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const input = parseRequest(LengthRequest, await readJsonBody(request));
    const { post_path, previous_path } = await changeLength(input);
    return Response.json({ post_path, previous_path });
  } catch (err) {
    return errorResponse(err);
  }
}
