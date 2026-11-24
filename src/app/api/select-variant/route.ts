import { requireLocal } from "@/lib/security/guard";
import { selectVariant } from "@/lib/pipeline/daily/select-variant";
import { errorResponse } from "@/lib/pipeline/daily/errors";
import { readJsonBody } from "@/lib/pipeline/daily/http";
import { parseRequest, SelectVariantRequest } from "@/lib/pipeline/daily/requests";

export async function POST(request: Request) {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const input = parseRequest(SelectVariantRequest, await readJsonBody(request));
    const { post_path } = await selectVariant(input);
    return Response.json({ post_path });
  } catch (err) {
    return errorResponse(err);
  }
}
