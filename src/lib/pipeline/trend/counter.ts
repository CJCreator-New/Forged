// Monthly search counters, stored in config/counters.json (the only file the app writes outside content/).
// Shape: { "tavily": { "2026-11": { "credits": 12 } }, "firecrawl": { "2026-11": { "credits": 4 } } }
// Counts are credits, not searches. Keys are UTC year-months.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { configDir } from "../../config/loaders";
import { TrendError } from "./errors";
import { type SearchProvider } from "./providers";

const PROVIDERS: SearchProvider[] = ["tavily", "firecrawl"];

export type CountersFile = Record<SearchProvider, Record<string, { credits: number }>>;

function emptyCounters(): CountersFile {
  return { tavily: {}, firecrawl: {} };
}

export function defaultCountersPath(): string {
  return path.join(configDir(), "counters.json");
}

export function monthKey(now: Date): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

export function readCounters(file: string): CountersFile {
  if (!existsSync(file)) return emptyCounters();
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    // Refuse to guess: a reset here would lift the cap.
    throw new TrendError(
      "counter_unreadable",
      `The search counter file ${file} is not valid JSON. Fix or restore it before running trend search.`,
    );
  }
  const clean = emptyCounters();
  for (const provider of PROVIDERS) {
    const section = (parsed as Record<string, unknown> | null)?.[provider];
    if (typeof section !== "object" || section === null || Array.isArray(section)) continue;
    for (const [key, value] of Object.entries(section as Record<string, unknown>)) {
      const credits = (value as { credits?: unknown } | null)?.credits;
      if (typeof credits === "number" && Number.isInteger(credits) && credits >= 0) {
        clean[provider][key] = { credits };
      }
    }
  }
  return clean;
}

export function creditsUsed(file: string, provider: SearchProvider, now: Date): number {
  return readCounters(file)[provider][monthKey(now)]?.credits ?? 0;
}

// Adds credits to the current month. Writes to a temp file, then renames it over the real file.
export function addCredits(
  file: string,
  provider: SearchProvider,
  credits: number,
  now: Date,
): number {
  const counters = readCounters(file);
  const key = monthKey(now);
  const next = (counters[provider][key]?.credits ?? 0) + credits;
  counters[provider][key] = { credits: next };

  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(counters, null, 2) + "\n", "utf8");
  renameSync(tmp, file);
  return next;
}
