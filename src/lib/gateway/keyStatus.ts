import { getOpenRouterKey } from "./keys";
import { GatewayError } from "./errors";
import type { GatewayOptions } from "./openrouter";

const KEY_URL = "https://openrouter.ai/api/v1/key";
const TIMEOUT_MS = 30_000;

export type KeyStatus = {
  valid: boolean;
  isFreeTier: boolean;
  limitRemaining: number | null;
};

// Reads the key's status. Makes no model call. A rejected key returns valid: false.
export async function checkKey(opts: GatewayOptions = {}): Promise<KeyStatus> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const apiKey = getOpenRouterKey();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(KEY_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      return { valid: false, isFreeTier: false, limitRemaining: null };
    }
    if (!res.ok) {
      throw new GatewayError(
        "provider_error",
        `OpenRouter returned HTTP ${res.status} when checking the key.`,
        { status: res.status },
      );
    }

    const body = (await res.json()) as {
      data?: { is_free_tier?: unknown; limit_remaining?: unknown };
    };
    const limit = body.data?.limit_remaining;
    return {
      valid: true,
      isFreeTier: body.data?.is_free_tier === true,
      limitRemaining: typeof limit === "number" ? limit : null,
    };
  } catch (err) {
    if (err instanceof GatewayError) throw err;
    if (controller.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
      throw new GatewayError("timeout", "Checking the key took longer than 30 seconds.");
    }
    throw new GatewayError("network_error", "Could not reach OpenRouter to check the key.");
  } finally {
    clearTimeout(timer);
  }
}
