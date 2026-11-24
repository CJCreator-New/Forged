import { requireLocal } from "../../../lib/security/guard";
import { loadModels } from "../../../lib/config/loaders";
import { readSwitches } from "../../../lib/config/switches";
import { ConfigError } from "../../../lib/config/errors";
import { BRAVE_MONTHLY_CAP } from "../../../lib/pipeline/trend/counter";
import { getBraveUsage } from "../../../lib/pipeline/trend/trend";
import { errorJson } from "../../../components/settings/apiErrors";
import { modelCallsToday } from "./usage";

// The two keys this app reads. Only presence is reported, never the value (ADR 0004).
const KEY_NAMES = ["OPENROUTER_API_KEY", "BRAVE_API_KEY"] as const;

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

    // Brave usage is null when the counter file is unreadable, so the screen shows "not available yet".
    let braveMonth: ReturnType<typeof getBraveUsage> | null = null;
    try {
      braveMonth = getBraveUsage();
    } catch {
      braveMonth = null;
    }

    return Response.json({
      switches,
      keys,
      // free_only and selectable_models come from the live model list, which the screen loads
      // from /api/models. They are not known here, so they are null and empty.
      models: { tasks, free_only: null, selectable_models: [] },
      counters: {
        brave_month: braveMonth,
        model_calls_today: modelCallsToday(new Date()),
      },
      brave_cap: BRAVE_MONTHLY_CAP,
    });
  } catch (err) {
    if (err instanceof ConfigError) {
      return errorJson(500, "invalid_config", "A settings file is not valid. Check the config folder.");
    }
    return errorJson(500, "unexpected_error", "Could not load settings. Try again.");
  }
}
