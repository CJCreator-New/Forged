import { requireLocal } from "../../../../lib/security/guard";
import { checkKey } from "../../../../lib/gateway/keyStatus";
import { errorJson, gatewayErrorResponse } from "../../../../components/settings/apiErrors";

// Checks the OpenRouter key's status. Makes no model call.
export async function POST(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson(400, "invalid_json", "The request body must be JSON.");
  }

  const provider = (body as { provider?: unknown } | null)?.provider;
  if (provider !== "openrouter") {
    return errorJson(400, "unknown_provider", "Only the OpenRouter key can be checked here.");
  }

  try {
    const status = await checkKey();
    return Response.json({
      valid: status.valid,
      is_free_tier: status.isFreeTier,
      limit_remaining: status.limitRemaining,
    });
  } catch (err) {
    return gatewayErrorResponse(err);
  }
}
