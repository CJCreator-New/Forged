// Readers for config/models.json, config/channels.json and config/styles/*.json.
// Every call reads from disk again. Nothing is cached, so an edit takes effect without a restart.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  ChannelsConfigSchema,
  ModelsConfigSchema,
  StyleSchema,
  type ChannelsConfig,
  type ModelsConfig,
  type Style,
} from "../schemas/config";
import { ConfigError } from "./errors";

export function configDir(): string {
  return path.join(process.cwd(), "config");
}

// Reads and JSON-parses one config file. Errors name the file.
export function readJsonFile(filePath: string): unknown {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (err) {
    throw new ConfigError("read_failed", `Cannot read config file ${filePath}: ${(err as Error).message}`, {
      file: filePath,
    });
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new ConfigError("invalid_json", `Config file ${filePath} is not valid JSON: ${(err as Error).message}`, {
      file: filePath,
    });
  }
}

// Validates data against a schema. On failure throws an error naming the file and the first failing path.
export function parseWithSchema<T>(filePath: string, schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const where = issue.path.length > 0 ? issue.path.map(String).join(".") : "(top level)";
  throw new ConfigError(
    "invalid_config",
    `Config file ${filePath} is invalid at "${where}": ${issue.message}`,
    { file: filePath, path: where },
  );
}

export function loadModels(): ModelsConfig {
  const file = path.join(configDir(), "models.json");
  return parseWithSchema(file, ModelsConfigSchema, readJsonFile(file));
}

export function loadChannels(): ChannelsConfig {
  const file = path.join(configDir(), "channels.json");
  return parseWithSchema(file, ChannelsConfigSchema, readJsonFile(file));
}

export function loadStyles(): Style[] {
  const dir = path.join(configDir(), "styles");
  if (!existsSync(dir)) {
    throw new ConfigError("missing_styles_dir", `Styles folder not found: ${dir}`, { file: dir });
  }
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();

  const styles: Style[] = [];
  const seen = new Map<string, string>();
  for (const name of files) {
    const file = path.join(dir, name);
    const style = parseWithSchema(file, StyleSchema, readJsonFile(file));
    const earlier = seen.get(style.id);
    if (earlier) {
      throw new ConfigError(
        "duplicate_style_id",
        `Style id "${style.id}" is used by both ${earlier} and ${file}`,
        { file, id: style.id },
      );
    }
    seen.set(style.id, file);
    styles.push(style);
  }
  return styles.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function getStyle(id: string): Style {
  const style = loadStyles().find((s) => s.id === id);
  if (!style) {
    throw new ConfigError("unknown_style", `Unknown style "${id}"`, { id });
  }
  return style;
}
