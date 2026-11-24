// Settings for the two free search services used by trend mode.
// Caps and costs are in credits, per UTC month. Change the numbers here only.

export type SearchProvider = "tavily" | "firecrawl";

// Monthly caps in credits. Both free plans give 1,000 credits a month; 900 leaves a small margin.
export const MONTHLY_CAP_CREDITS: Record<SearchProvider, number> = {
  tavily: 900,
  firecrawl: 900,
};

// Credits charged per search call, matching the providers' published pricing.
// Tavily basic search: 1 credit. Firecrawl search: 2 credits per 10 results, rounded up, so 5 results = 2 credits.
export const CREDITS_PER_SEARCH: Record<SearchProvider, number> = {
  tavily: 1,
  firecrawl: 2,
};

export const KEY_NAMES: Record<SearchProvider, string> = {
  tavily: "TAVILY_API_KEY",
  firecrawl: "FIRECRAWL_API_KEY",
};

export type TrendItem = { url: string; title: string };

export const MAX_RESULTS = 5;
export const REQUEST_TIMEOUT_MS = 15_000;
// At least this gap between any two search calls, across both providers.
export const MIN_GAP_MS = 1000;
