import type { ZodType } from "zod";
import { GatewayError } from "./errors";
import { runWithFallback, type FallbackResult, type TaskName } from "./fallback";
import type { ChatMessage, GatewayOptions } from "./openrouter";

export const CORRECTION_MESSAGE =
  "Your last reply was not valid JSON in the required shape. Reply again with only the JSON. No code fences, no commentary.";

// Removes a ```json ... ``` (or plain ```) wrapper if the model added one.
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const match = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(trimmed);
  return (match ? match[1] : trimmed).trim();
}

type ParseOutcome<T> = { ok: true; value: T } | { ok: false };

function tryParse<T>(text: string, schema: ZodType<T>): ParseOutcome<T> {
  let raw: unknown;
  try {
    raw = JSON.parse(stripCodeFences(text));
  } catch {
    return { ok: false };
  }
  const result = schema.safeParse(raw);
  return result.success ? { ok: true, value: result.data } : { ok: false };
}

// Parses and validates. If that fails, calls retry() once with a correction message.
// The retry returns the new model text. If the retry also fails, throws invalid_output.
export async function parseAndValidate<T>(
  text: string,
  schema: ZodType<T>,
  retry: (correction: string) => Promise<string>,
): Promise<T> {
  const first = tryParse(text, schema);
  if (first.ok) return first.value;

  const retried = await retry(CORRECTION_MESSAGE);
  const second = tryParse(retried, schema);
  if (second.ok) return second.value;

  throw new GatewayError(
    "invalid_output",
    "The model's answer was not in the expected format, even after one retry.",
  );
}

export type JsonResult<T> = FallbackResult & { data: T };

// Runs a task through the fallback chain and validates its JSON.
// The one retry goes back through the same chain, with the bad reply and the correction added.
export async function runJson<T>(
  task: TaskName | string,
  messages: ChatMessage[],
  schema: ZodType<T>,
  opts: GatewayOptions = {},
): Promise<JsonResult<T>> {
  const first = await runWithFallback(task, messages, opts);
  let lastText = first.text;
  let lastModel = first.model_used;
  let fallbackFrom = first.fallback_from;

  const data = await parseAndValidate(first.text, schema, async (correction) => {
    const retryMessages: ChatMessage[] = [
      ...messages,
      { role: "assistant", content: lastText },
      { role: "user", content: correction },
    ];
    const retried = await runWithFallback(task, retryMessages, opts);
    lastText = retried.text;
    lastModel = retried.model_used;
    fallbackFrom = fallbackFrom ?? retried.fallback_from;
    return retried.text;
  });

  return {
    data,
    text: lastText,
    model_used: lastModel,
    ...(fallbackFrom ? { fallback_from: fallbackFrom } : {}),
  };
}
