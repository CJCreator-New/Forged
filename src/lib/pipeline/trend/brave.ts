// One Brave Web Search call, paced to one request per second.
// The key is read from process.env on every call and is only ever put in the request header.
import { logCall } from "../../gateway/log";
import { TrendError } from "./errors";

export const BRAVE_KEY_NAME = "BRAVE_API_KEY";
const BRAVE_URL = "https://api.search.brave.com/res/v1/web/search";
const TIMEOUT_MS = 15_000;
const MIN_GAP_MS = 1000;
const MAX_RESULTS = 5;

export type TrendItem = { url: string; title: string };

export function getBraveKey(): string {
  const value = process.env[BRAVE_KEY_NAME];
  if (!value || value.trim() === "") {
    throw new TrendError("missing_key", `${BRAVE_KEY_NAME} is not set. Add it to .env.local.`, {
      key: BRAVE_KEY_NAME,
    });
  }
  return value.trim();
}

// Next free send time. Slots are handed out in order, so two callers in the same tick
// are spaced MIN_GAP_MS apart rather than both reading the same "last call" time.
let nextAllowedAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Tests only: forget the previous send time so each test starts with a free slot.
export function resetBravePacingForTests(): void {
  nextAllowedAt = 0;
}

export async function paceBrave(): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextAllowedAt);
  nextAllowedAt = slot + MIN_GAP_MS;
  const wait = slot - now;
  if (wait > 0) await sleep(wait);
}

function toHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Keeps only url and title from the first results. Snippets and page text are never stored.
export function pickItems(body: unknown): TrendItem[] {
  const results = (body as { web?: { results?: unknown } } | null)?.web?.results;
  if (!Array.isArray(results)) return [];
  const items: TrendItem[] = [];
  for (const result of results) {
    if (items.length >= MAX_RESULTS) break;
    const url = (result as { url?: unknown })?.url;
    const title = (result as { title?: unknown })?.title;
    if (typeof url !== "string" || typeof title !== "string") continue;
    if (!toHttpUrl(url)) continue;
    items.push({ url, title: title.trim() });
  }
  return items;
}

// Caller must hold the Brave lock and call paceBrave() first.
export async function callBrave(
  query: string,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<TrendItem[]> {
  const params = new URLSearchParams({ q: query, count: String(MAX_RESULTS) });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let status: number | null = null;

  try {
    const res = await fetchImpl(`${BRAVE_URL}?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
      signal: controller.signal,
    });
    status = res.status;
    if (!res.ok) {
      throw new TrendError("brave_error", `Brave Search returned HTTP ${res.status}.`, {
        status: res.status,
      });
    }
    const body = (await res.json()) as unknown;
    return pickItems(body);
  } catch (err) {
    if (err instanceof TrendError) throw err;
    if (controller.signal.aborted) {
      throw new TrendError("brave_error", "Brave Search did not answer within 15 seconds.");
    }
    throw new TrendError("brave_error", "Could not reach Brave Search.");
  } finally {
    clearTimeout(timer);
    logCall({ provider: "brave", model: "web-search", tokens: null, status });
  }
}
