import { requireLocal } from "@/lib/security/guard";
import { generateVariants } from "@/lib/pipeline/daily/variants";
import { errorResponse } from "@/lib/pipeline/daily/errors";
import { readJsonBody } from "@/lib/pipeline/daily/http";
import { parseRequest, VariantsRequest } from "@/lib/pipeline/daily/requests";

export async function POST(request: Request) {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const input = parseRequest(VariantsRequest, await readJsonBody(request));
    return Response.json(await generateVariants(input));
  } catch (err) {
    return errorResponse(err);
  }
}
