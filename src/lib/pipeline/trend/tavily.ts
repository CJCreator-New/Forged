// Tavily search adapter (primary). Basic search costs 1 credit per call.
// Docs: https://docs.tavily.com/documentation/api-reference/endpoint/search.md
import { TrendError } from "./errors";
import { KEY_NAMES, MAX_RESULTS, type TrendItem } from "./providers";
import { sendSearch } from "./request";

export const TAVILY_URL = "https://api.tavily.com/search";
export const TAVILY_KEY_NAME = KEY_NAMES.tavily;

export function getTavilyKey(): string {
  const value = process.env[TAVILY_KEY_NAME];
  if (!value || value.trim() === "") {
    throw new TrendError("missing_key", `${TAVILY_KEY_NAME} is not set. Add it to .env.local.`, {
      key: TAVILY_KEY_NAME,
    });
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

// Keeps only url and title from the first results. Content and page text are never stored.
export function pickTavilyItems(body: unknown): TrendItem[] {
  const results = (body as { results?: unknown } | null)?.results;
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
export async function searchTavily(
  query: string,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<TrendItem[]> {
  const body = await sendSearch(
    "tavily",
    fetchImpl,
    TAVILY_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: MAX_RESULTS,
      }),
    },
    "Tavily search",
  );
  return pickTavilyItems(body);
}
