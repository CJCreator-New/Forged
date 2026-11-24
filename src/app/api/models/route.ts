import { requireLocal } from "../../../lib/security/guard";
import { fetchModels } from "../../../lib/gateway/models";
import { OPENROUTER_KEY_NAME } from "../../../lib/gateway/keys";
import { errorJson, gatewayErrorResponse } from "../../../components/settings/apiErrors";

// Fetched fresh on every call. The settings screen calls this each time it opens.
// The model list is public, but the app still needs its OpenRouter key set before it lists models.
export async function GET(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;

  if ((process.env[OPENROUTER_KEY_NAME] ?? "").trim() === "") {
    return errorJson(400, "missing_key", `${OPENROUTER_KEY_NAME} is not set. Add it to .env.local.`, OPENROUTER_KEY_NAME);
  }

  try {
    const models = await fetchModels();
    return Response.json({ fetched_at: new Date().toISOString(), models });
  } catch (err) {
    return gatewayErrorResponse(err);
  }
}
