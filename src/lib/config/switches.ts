// Reader and writer for config/features.json (the feature switches, ADR 0005).
// Reads go to disk on every call. Writes touch config/features.json and nothing else.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { FEATURE_DEFAULTS } from "../features/defaults";
import { ConfigError } from "./errors";
import { configDir, parseWithSchema, readJsonFile } from "./loaders";

// Same shape as FEATURE_DEFAULTS. Strict, so unknown nested keys are refused too.
export const SwitchesSchema = z
  .object({
    trend_mode: z.boolean(),
    humanise: z.boolean(),
    carousel_render: z.boolean(),
    icons: z.boolean(),
    theme: z.string().min(1),
    styling: z
      .object({ corner: z.string().min(1), card: z.string().min(1), padding: z.string().min(1) })
      .strict(),
    logo: z
      .object({
        enabled: z.boolean(),
        corner: z.string().min(1),
        size: z.string().min(1),
        opacity: z.number().min(0).max(1),
        all_slides: z.boolean(),
      })
      .strict(),
    variants: z.number().int().min(1),
    length: z.string().min(1),
    performance_loop: z
      .object({
        enabled: z.boolean(),
        min_posts: z.number().int().nonnegative(),
        min_group: z.number().int().nonnegative(),
      })
      .strict(),
    linter_soft_warnings: z.boolean(),
  })
  .strict();

export type Switches = z.infer<typeof SwitchesSchema>;

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type SwitchPatch = DeepPartial<Switches>;

const FEATURES_FILE = () => path.join(configDir(), "features.json");

export function readSwitches(): Switches {
  const file = FEATURES_FILE();
  return parseWithSchema(file, SwitchesSchema, readJsonFile(file));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = out[key];
    out[key] = isPlainObject(value) && isPlainObject(current) ? deepMerge(current, value) : value;
  }
  return out;
}

// Merges a patch into config/features.json, validates the result, then writes it.
// Throws unknown_switch for a top-level key that is not in FEATURE_DEFAULTS, and
// invalid_config if the merged result breaks the shape. Nothing is written on error.
export function writeSwitches(patch: SwitchPatch): Switches {
  if (!isPlainObject(patch)) {
    throw new ConfigError("invalid_patch", "Switch patch must be an object");
  }
  const allowed = new Set<string>(Object.keys(FEATURE_DEFAULTS));
  for (const key of Object.keys(patch)) {
    if (!allowed.has(key)) {
      throw new ConfigError("unknown_switch", `Unknown switch "${key}"`, { key });
    }
  }

  const file = FEATURES_FILE();
  const current = readJsonFile(file);
  if (!isPlainObject(current)) {
    throw new ConfigError("invalid_config", `Config file ${file} must contain a JSON object`, { file });
  }
  const merged = parseWithSchema(file, SwitchesSchema, deepMerge(current, patch as Record<string, unknown>));

  writeFileSync(file, JSON.stringify(merged, null, 2) + "\n", "utf8");
  return merged;
}
