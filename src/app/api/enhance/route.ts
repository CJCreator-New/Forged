// POST /api/enhance: rewrite one Post for a chosen aim (docs/api-contract.md).
import { requireLocal } from "../../../lib/security/guard";
import { enhancePost, EnhanceError } from "../../../lib/pipeline/enhance/enhance";

function fail(code: string, message: string, status: number, key?: string): Response {
  return Response.json({ error: { code, message, ...(key ? { key } : {}) } }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("bad_request", "Request body must be JSON.", 400);
  }
  if (typeof body !== "object" || body === null) {
    return fail("bad_request", "Request body must be an object.", 400);
  }
  const input = body as { post_path?: unknown; aim?: unknown; note?: unknown };

  try {
    const outcome = await enhancePost({ post_path: input.post_path, aim: input.aim, note: input.note });
    if (!outcome.facts_preserved) {
      return Response.json(
        { code: outcome.code, facts_preserved: false, missing: outcome.missing },
        { status: 200 },
      );
    }
    return Response.json(
      {
        post_path: outcome.post_path,
        previous_path: outcome.previous_path,
        lint: outcome.lint,
        facts_preserved: true,
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof EnhanceError) {
      return fail(err.code, err.message, err.status, err.key);
    }
    return fail("internal_error", "Enhance failed unexpectedly.", 500);
  }
}
