import { readFileSync } from "node:fs";
import path from "node:path";
import type { ZodType } from "zod";

export interface Prompt {
  system?: string;
  user: string;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ModelResult {
  text: string;
  model: string;
  usage: Usage;
  attempts: string[];
}

interface TaskConfig {
  primary: string;
  fallback: string[];
}

const DEFAULT_TIMEOUT_MS = 45_000;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** A failure that should move on to the next model in the list. */
class RetryableError extends Error {}

export function gatewayStatus(): { openrouter: boolean; anthropic: boolean; openai: boolean } {
  return {
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
  };
}

function loadTask(task: string): TaskConfig {
  const file = path.join(process.cwd(), "config", "models.json");
  const cfg = JSON.parse(readFileSync(file, "utf8")) as { tasks?: Record<string, TaskConfig> };
  const t = cfg.tasks?.[task];
  if (!t || !t.primary) throw new Error(`No model configured for task "${task}"`);
  return { primary: t.primary, fallback: t.fallback ?? [] };
}

function logLine(model: string, status: string, usage?: Usage): void {
  const tokens = usage ? ` tokens=${usage.totalTokens}` : "";
  console.log(`[gateway] model=${model} status=${status}${tokens}`);
}

async function callOpenRouter(
  modelId: string,
  prompt: Prompt,
  timeoutMs: number,
): Promise<{ text: string; usage: Usage }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");

  const messages: { role: string; content: string }[] = [];
  if (prompt.system) messages.push({ role: "system", content: prompt.system });
  messages.push({ role: "user", content: prompt.user });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelId, messages }),
      signal: controller.signal,
    });
  } catch {
    throw new RetryableError("network error or timeout");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429 || res.status >= 500) {
    throw new RetryableError(`HTTP ${res.status}`);
  }
  if (!res.ok) throw new Error(`OpenRouter returned HTTP ${res.status}`);

  let data: {
    choices?: { message?: { content?: string | null } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  try {
    data = await res.json();
  } catch {
    throw new RetryableError("unreadable response body");
  }
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new RetryableError("empty response");
  const u = data.usage ?? {};
  const inTokens = u.prompt_tokens ?? 0;
  const outTokens = u.completion_tokens ?? 0;
  return {
    text,
    usage: {
      promptTokens: inTokens,
      completionTokens: outTokens,
      totalTokens: u.total_tokens ?? inTokens + outTokens,
    },
  };
}

// Optional adapters. Stubs only: they never make a call.
function callAnthropic(): never {
  throw new RetryableError("anthropic adapter not configured");
}

function callOpenAI(): never {
  throw new RetryableError("openai adapter not configured");
}

export async function callModel(
  task: string,
  prompt: Prompt,
  opts: { json?: boolean; timeoutMs?: number } = {},
): Promise<ModelResult> {
  const cfg = loadTask(task);
  const list = [cfg.primary, ...cfg.fallback];
  const attempts: string[] = [];
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const effective: Prompt = opts.json
    ? {
        system: `${prompt.system ? prompt.system + "\n\n" : ""}Respond with valid JSON only. No prose, no code fences.`,
        user: prompt.user,
      }
    : prompt;

  for (const entry of list) {
    const sep = entry.indexOf(":");
    const provider = entry.slice(0, sep);
    const modelId = entry.slice(sep + 1);
    attempts.push(modelId);
    try {
      let out: { text: string; usage: Usage };
      if (provider === "openrouter") out = await callOpenRouter(modelId, effective, timeoutMs);
      else if (provider === "anthropic") out = callAnthropic();
      else if (provider === "openai") out = callOpenAI();
      else throw new RetryableError(`unknown provider ${provider}`);
      logLine(modelId, "ok", out.usage);
      return { text: out.text, model: modelId, usage: out.usage, attempts };
    } catch (err) {
      if (err instanceof RetryableError) {
        logLine(modelId, `failed (${err.message})`);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`All models failed for task "${task}". Tried: ${attempts.join(", ")}`);
}

function stripFences(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1] : t;
}

/** Calls the model for JSON, validates with zod, retries once on parse or validation failure. */
export async function callJson<T>(task: string, prompt: Prompt, schema: ZodType<T>): Promise<T> {
  let lastMessage = "unknown error";
  for (let i = 0; i < 2; i++) {
    const res = await callModel(task, prompt, { json: true });
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFences(res.text));
    } catch {
      lastMessage = "Model output was not valid JSON";
      logLine(res.model, "bad json");
      continue;
    }
    const check = schema.safeParse(parsed);
    if (check.success) return check.data;
    lastMessage = check.error.message;
    logLine(res.model, "schema mismatch");
  }
  throw new Error(`JSON validation failed after retry: ${lastMessage}`);
}
