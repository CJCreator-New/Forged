import { requireLocal } from "../../../lib/security/guard";
import { FEATURE_DEFAULTS } from "../../../lib/features/defaults";
import { readSwitches, writeSwitches, type SwitchPatch } from "../../../lib/config/switches";
import { ConfigError } from "../../../lib/config/errors";
import { errorJson } from "../../../components/settings/apiErrors";

type SwitchKey = keyof typeof FEATURE_DEFAULTS;

function isSwitchKey(key: unknown): key is SwitchKey {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(FEATURE_DEFAULTS, key);
}

// Each switch with its default and its current value from config/features.json.
export async function GET(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;

  try {
    const current = readSwitches();
    const switches = (Object.keys(FEATURE_DEFAULTS) as SwitchKey[]).map((key) => ({
      key,
      default: FEATURE_DEFAULTS[key],
      current: current[key],
    }));
    return Response.json({ switches });
  } catch (err) {
    if (err instanceof ConfigError) {
      return errorJson(500, "invalid_config", "The feature switch file is not valid. Check config/features.json.");
    }
    return errorJson(500, "unexpected_error", "Could not read the switches. Try again.");
  }
}

// Changes one switch. The key is checked here, then the value is checked by writeSwitches,
// which validates the whole file before writing. An unknown key writes nothing.
export async function PATCH(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson(400, "invalid_json", "The request body must be JSON.");
  }

  const { key, value } = (body ?? {}) as { key?: unknown; value?: unknown };
  if (!isSwitchKey(key)) {
    return errorJson(400, "unknown_switch", "That switch does not exist.");
  }
  if (value === undefined) {
    return errorJson(400, "invalid_value", "A value is needed for this switch.", undefined);
  }

  try {
    const patch = { [key]: value } as SwitchPatch;
    const saved = writeSwitches(patch);
    return Response.json({ key, value: saved[key] });
  } catch (err) {
    if (err instanceof ConfigError && err.code === "invalid_config") {
      return errorJson(400, "invalid_value", "That value is not allowed for this switch.");
    }
    return errorJson(500, "write_failed", "Could not save the switch. Try again.");
  }
}
