// Monthly Brave query counter, stored in config/counters.json (the only file the app writes outside content/).
// Shape: { "brave": { "2026-11": 12 } }. Keys are UTC year-months.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { configDir } from "../../config/loaders";
import { TrendError } from "./errors";

export const BRAVE_MONTHLY_CAP = 900;

export type CountersFile = { brave: Record<string, number> };

export function defaultCountersPath(): string {
  return path.join(configDir(), "counters.json");
}

export function monthKey(now: Date): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

export function readCounters(file: string): CountersFile {
  if (!existsSync(file)) return { brave: {} };
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
  const brave = (parsed as { brave?: unknown } | null)?.brave;
  if (typeof brave !== "object" || brave === null || Array.isArray(brave)) {
    throw new TrendError(
      "counter_unreadable",
      `The search counter file ${file} has no "brave" section. Fix or restore it before running trend search.`,
    );
  }
  const clean: Record<string, number> = {};
  for (const [key, value] of Object.entries(brave as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) clean[key] = value;
  }
  return { brave: clean };
}

export function usedThisMonth(file: string, now: Date): number {
  return readCounters(file).brave[monthKey(now)] ?? 0;
}

// Adds one to the current month. Writes to a temp file, then renames it over the real file.
export function incrementBraveCount(file: string, now: Date): number {
  const counters = readCounters(file);
  const key = monthKey(now);
  const next = (counters.brave[key] ?? 0) + 1;
  counters.brave[key] = next;

  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(counters, null, 2) + "\n", "utf8");
  renameSync(tmp, file);
  return next;
}
