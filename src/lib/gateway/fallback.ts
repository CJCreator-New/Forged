import { loadModels } from "../config/loaders";
import { chat, type ChatMessage, type GatewayOptions } from "./openrouter";
import { GatewayError } from "./errors";

// Adapter interface for later waves (Anthropic and OpenAI are out of scope for now).
// An adapter would expose: chat(model, messages, opts) returning { text, model, tokens, status },
// and be picked by a "provider:model" prefix in config/models.json. Only OpenRouter exists today.

export type TaskName = keyof ReturnType<typeof loadModels>["tasks"];

export type FallbackResult = {
  text: string;
  model_used: string;
  // First model that failed with rate_limited or timeout. Written to the post frontmatter.
  fallback_from?: string;
};

const MOVE_ON_CODES = new Set(["rate_limited", "timeout"]);

export function getTaskModels(task: string): { primary: string; fallback: string[] } {
  // Read fresh on every call, so an edit to config/models.json takes effect without a restart.
  const tasks = loadModels().tasks as Record<string, { primary: string; fallback: string[] }>;
  const entry = tasks[task];
  if (!entry) {
    throw new GatewayError("unknown_task", `No model is configured for task "${task}".`);
  }
  return { primary: entry.primary, fallback: [...entry.fallback] };
}

// Tries the primary model, then each fallback in order.
// Moves on only for rate_limited or timeout. Any other error is thrown at once.
export async function runWithFallback(
  task: TaskName | string,
  messages: ChatMessage[],
  opts: GatewayOptions = {},
): Promise<FallbackResult> {
  const { primary, fallback } = getTaskModels(task);
  const candidates = [primary, ...fallback];
  let firstFailed: string | undefined;

  for (const model of candidates) {
    try {
      const result = await chat(model, messages, opts);
      return {
        text: result.text,
        model_used: result.model,
        ...(firstFailed ? { fallback_from: firstFailed } : {}),
      };
    } catch (err) {
      if (err instanceof GatewayError && MOVE_ON_CODES.has(err.code)) {
        firstFailed ??= model;
        continue;
      }
      throw err;
    }
  }

  throw new GatewayError(
    "all_models_failed",
    `Every model for task "${task}" was rate limited or timed out. Try again later.`,
  );
}
