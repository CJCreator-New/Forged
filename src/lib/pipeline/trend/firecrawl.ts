// Firecrawl search adapter (backup). Search costs 2 credits per 10 results, rounded up, so 5 results = 2 credits.
// Docs: https://docs.firecrawl.dev/features/search.md (header: "Authorization: Bearer fc-YOUR_API_KEY")
// and https://docs.firecrawl.dev/api-reference/endpoint/search.md (POST /v2/search, results at data.web).
import { TrendError } from "./errors";
import { KEY_NAMES, MAX_RESULTS, type TrendItem } from "./providers";
import { sendSearch } from "./request";

export const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/search";
export const FIRECRAWL_KEY_NAME = KEY_NAMES.firecrawl;

export function getFirecrawlKey(): string {
  const value = process.env[FIRECRAWL_KEY_NAME];
  if (!value || value.trim() === "") {
    throw new TrendError(
      "missing_key",
      `${FIRECRAWL_KEY_NAME} is not set. Add it to .env.local.`,
      { key: FIRECRAWL_KEY_NAME },
    );
  }
  return value.trim();
}

function toHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Reads data.web, keeping only url and title. Descriptions and page markdown are never stored.
export function pickFirecrawlItems(body: unknown): TrendItem[] {
  const results = (body as { data?: { web?: unknown } } | null)?.data?.web;
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

// Caller must hold the search lock and call paceSearch() first.
export async function searchFirecrawl(
  query: string,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<TrendItem[]> {
  const body = await sendSearch(
    "firecrawl",
    fetchImpl,
    FIRECRAWL_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, limit: MAX_RESULTS, sources: ["web"] }),
    },
    "Firecrawl search",
  );
  return pickFirecrawlItems(body);
}
