// Server-only helpers for the call counters shown on the settings screen.
// Model calls per provider per day come from config/counters.json under "model_calls", keyed by
// local date. The file is read only, never created here. Missing or unreadable means 0.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { configDir } from "../../../lib/config/loaders";

export const PROVIDERS = ["openrouter"] as const;

// Local calendar day as YYYY-MM-DD (the app uses local time for day boundaries).
export function localDayKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function modelCallsToday(now: Date, file: string = path.join(configDir(), "counters.json")): Record<string, number> {
  const zeros = Object.fromEntries(PROVIDERS.map((p) => [p, 0])) as Record<string, number>;
  // The path is fixed to config/counters.json, so the build's file tracing can ignore it.
  if (!existsSync(/*turbopackIgnore: true*/ file)) return zeros;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(/*turbopackIgnore: true*/ file, "utf8"));
  } catch {
    return zeros;
  }
  const today = (parsed as { model_calls?: Record<string, unknown> } | null)?.model_calls?.[localDayKey(now)];
  if (typeof today !== "object" || today === null) return zeros;
  const out = { ...zeros };
  for (const provider of PROVIDERS) {
    const n = (today as Record<string, unknown>)[provider];
    if (typeof n === "number" && Number.isInteger(n) && n >= 0) out[provider] = n;
  }
  return out;
}
