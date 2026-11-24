// Shared HTTP plumbing for both search adapters: pacing across providers, timeout, error mapping, and logging.
// Keys are passed in headers only. They are never put in an error message or a log line.
import { logCall } from "../../gateway/log";
import { TrendError } from "./errors";
import { MIN_GAP_MS, REQUEST_TIMEOUT_MS, type SearchProvider } from "./providers";

// Time the last search call was allowed to start. Shared by both providers.
let lastCallAt: number | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Tests only: forget the last call so each test starts with a free slot.
export function resetPacingForTests(): void {
  lastCallAt = null;
}

// Waits until at least MIN_GAP_MS has passed since the last search call, then records this one.
// Callers hold the search lock, so calls are handed out in order.
export async function paceSearch(): Promise<void> {
  const now = Date.now();
  const wait = lastCallAt === null ? 0 : Math.max(0, lastCallAt + MIN_GAP_MS - now);
  lastCallAt = now + wait;
  if (wait > 0) await sleep(wait);
}

export async function sendSearch(
  provider: SearchProvider,
  fetchImpl: typeof fetch,
  url: string,
  init: { method: "GET" | "POST"; headers: Record<string, string>; body?: string },
  label: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let status: number | null = null;

  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal });
    status = res.status;
    if (res.status === 429) {
      throw new TrendError("rate_limited", `${label} is rate limited right now (HTTP 429).`, {
        status,
      });
    }
    if (!res.ok) {
      throw new TrendError("search_error", `${label} returned HTTP ${res.status}.`, {
        status: res.status,
      });
    }
    return (await res.json()) as unknown;
  } catch (err) {
    if (err instanceof TrendError) throw err;
    if (controller.signal.aborted) {
      throw new TrendError("timeout", `${label} did not answer within 15 seconds.`);
    }
    throw new TrendError("search_error", `Could not reach ${label}.`);
  } finally {
    clearTimeout(timer);
    logCall({ provider, model: "search", tokens: null, status });
  }
}
