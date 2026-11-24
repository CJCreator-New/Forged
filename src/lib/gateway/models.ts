import { GatewayError } from "./errors";
import type { GatewayOptions } from "./openrouter";

const MODELS_URL = "https://openrouter.ai/api/v1/models";
const TIMEOUT_MS = 30_000;

export type ModelInfo = {
  id: string;
  name: string;
  free: boolean;
};

// Fetches the public model list. No caching here: the settings screen calls it each time it opens.
// The list is public, so the key is not sent.
// A model is free when both prompt and completion prices are "0" (OpenRouter sends prices as strings).
export async function fetchModels(opts: GatewayOptions = {}): Promise<ModelInfo[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(MODELS_URL, { method: "GET", signal: controller.signal });
    if (!res.ok) {
      throw new GatewayError(
        "provider_error",
        `OpenRouter returned HTTP ${res.status} when listing models.`,
        { status: res.status },
      );
    }

    const body = (await res.json()) as {
      data?: { id?: unknown; name?: unknown; pricing?: { prompt?: unknown; completion?: unknown } }[];
    };
    const rows = Array.isArray(body.data) ? body.data : [];
    return rows
      .filter((m): m is { id: string; name?: unknown; pricing?: { prompt?: unknown; completion?: unknown } } =>
        typeof m.id === "string",
      )
      .map((m) => ({
        id: m.id,
        name: typeof m.name === "string" ? m.name : m.id,
        free: m.pricing?.prompt === "0" && m.pricing?.completion === "0",
      }));
  } catch (err) {
    if (err instanceof GatewayError) throw err;
    if (controller.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
      throw new GatewayError("timeout", "Loading the model list took longer than 30 seconds.");
    }
    throw new GatewayError("network_error", "Could not reach OpenRouter to load models.");
  } finally {
    clearTimeout(timer);
  }
}
