import { requireLocal } from "../../../lib/security/guard";
import { loadModels } from "../../../lib/config/loaders";
import { readSwitches } from "../../../lib/config/switches";
import { ConfigError } from "../../../lib/config/errors";
import { getSearchUsage } from "../../../lib/pipeline/trend/trend";
import { errorJson } from "../../../components/settings/apiErrors";
import { modelCallsToday } from "./usage";

// The keys this app reads. Only presence is reported, never the value (ADR 0004).
const KEY_NAMES = ["OPENROUTER_API_KEY", "TAVILY_API_KEY", "FIRECRAWL_API_KEY"] as const;

export async function GET(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;

  try {
    const switches = readSwitches();
    const { tasks } = loadModels();

    const keys = KEY_NAMES.map((name) => ({
      name,
      set: (process.env[name] ?? "").trim() !== "",
    }));

    // Search usage is null when the counter file is unreadable, so the screen shows "not available yet".
    let searchUsage: ReturnType<typeof getSearchUsage> | null = null;
    try {
      searchUsage = getSearchUsage();
    } catch {
      searchUsage = null;
    }

    return Response.json({
      switches,
      keys,
      // free_only and selectable_models come from the live model list, which the screen loads
      // from /api/models. They are not known here, so they are null and empty.
      models: { tasks, free_only: null, selectable_models: [] },
      counters: {
        // Monthly search credits used and left, per service (Tavily first, Firecrawl backup).
        search_month: searchUsage,
        model_calls_today: modelCallsToday(new Date()),
      },
    });
  } catch (err) {
    if (err instanceof ConfigError) {
      return errorJson(500, "invalid_config", "A settings file is not valid. Check the config folder.");
    }
    return errorJson(500, "unexpected_error", "Could not load settings. Try again.");
  }
}
