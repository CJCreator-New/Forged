import { logCall } from "./log";
import { getOpenRouterKey } from "./keys";
import { GatewayError } from "./errors";

const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 30_000;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatResult = {
  text: string;
  model: string;
  tokens: number | null;
  status: number;
};

export type GatewayOptions = {
  fetchImpl?: typeof fetch;
};

// One call to one model. Logs exactly once per attempt, with model, tokens and status only.
export async function chat(
  model: string,
  messages: ChatMessage[],
  opts: GatewayOptions = {},
): Promise<ChatResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const apiKey = getOpenRouterKey();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let status: number | null = null;
  let tokens: number | null = null;

  try {
    const res = await fetchImpl(CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages }),
      signal: controller.signal,
    });
    status = res.status;

    if (res.status === 429) {
      throw new GatewayError("rate_limited", `Model ${model} is rate limited.`, {
        status,
      });
    }
    if (!res.ok) {
      throw new GatewayError(
        "provider_error",
        `OpenRouter returned HTTP ${res.status} for model ${model}.`,
        { status },
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: unknown } }[];
      usage?: { total_tokens?: unknown };
    };
    tokens =
      typeof data.usage?.total_tokens === "number" ? data.usage.total_tokens : null;
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      throw new GatewayError(
        "provider_error",
        `Model ${model} returned no text.`,
        { status },
      );
    }
    return { text, model, tokens, status };
  } catch (err) {
    if (err instanceof GatewayError) throw err;
    if (controller.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
      throw new GatewayError("timeout", `Model ${model} did not answer within 30 seconds.`);
    }
    throw new GatewayError("network_error", `Could not reach OpenRouter for model ${model}.`);
  } finally {
    clearTimeout(timer);
    logCall({ provider: "openrouter", model, tokens, status });
  }
}
