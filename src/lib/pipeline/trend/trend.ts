// Trend search: one model call writes a search query, then one free search call fetches up to 5 links.
// Tavily is tried first, Firecrawl is the backup. Off unless the trend_mode switch is on.
// Stops with a plain message when neither provider can serve the request. Never continues without trends.
import { readSwitches } from "../../config/switches";
import { runWithFallback } from "../../gateway/fallback";
import { TrendError } from "./errors";
import { addCredits, creditsUsed, defaultCountersPath, monthKey } from "./counter";
import {
  CREDITS_PER_SEARCH,
  MONTHLY_CAP_CREDITS,
  type SearchProvider,
  type TrendItem,
} from "./providers";
import { paceSearch } from "./request";
import { getTavilyKey, searchTavily } from "./tavily";
import { getFirecrawlKey, searchFirecrawl } from "./firecrawl";

export type TrendOptions = {
  fetchImpl?: typeof fetch;
  now?: Date;
  // Tests point this at a temp file. The app uses config/counters.json.
  countersPath?: string;
};

export type TrendContext =
  | { skipped: true }
  | { skipped: false; query: string; provider: SearchProvider; items: TrendItem[] };

export type ProviderUsage = { used: number; cap: number; remaining: number };

export type SearchUsage = {
  month: string;
  tavily: ProviderUsage;
  firecrawl: ProviderUsage;
};

// Order of use. Tavily first, Firecrawl as the backup.
const ORDER: SearchProvider[] = ["tavily", "firecrawl"];

const ADAPTERS: Record<
  SearchProvider,
  { getKey: () => string; search: (query: string, key: string, fetchImpl: typeof fetch) => Promise<TrendItem[]> }
> = {
  tavily: { getKey: getTavilyKey, search: searchTavily },
  firecrawl: { getKey: getFirecrawlKey, search: searchFirecrawl },
};

const LABELS: Record<SearchProvider, string> = { tavily: "Tavily", firecrawl: "Firecrawl" };

// Prompt P8 (docs/04-architecture-and-prompts.md section 7).
function buildPrompt(topic: string): string {
  return `Topic: ${topic}\nReturn one search query of 3 to 6 words that finds recent, credible news on this topic. Return the query only.`;
}

const QUOTE_CHARS = /["'‘’“”`]/;

export function validateQuery(raw: string): string {
  const query = raw.trim();
  const words = query.split(/\s+/).filter((w) => w.length > 0);
  const problem =
    /[\r\n]/.test(query)
      ? "it spans more than one line"
      : QUOTE_CHARS.test(query)
        ? "it contains quote marks"
        : words.length < 3 || words.length > 6
          ? `it has ${words.length} words, but 3 to 6 are needed`
          : query.length > 60
            ? "it is longer than 60 characters"
            : null;
  if (problem) {
    throw new TrendError("bad_query", `The model returned an unusable search query: ${problem}.`);
  }
  return query;
}

// Searches run one at a time, so the credit check and the credit update cannot race.
let searchLock: Promise<unknown> = Promise.resolve();
function withSearchLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = searchLock.then(fn);
  searchLock = run.catch(() => undefined);
  return run;
}

// Tries Tavily, then Firecrawl. A provider at its cap is skipped. A failed call moves on to the next provider,
// except a missing key, which stops the task at once.
async function searchWithFallback(
  query: string,
  fetchImpl: typeof fetch,
  countersPath: string,
  now: Date,
): Promise<{ provider: SearchProvider; items: TrendItem[] }> {
  const reasons: string[] = [];

  for (const provider of ORDER) {
    const cost = CREDITS_PER_SEARCH[provider];
    const used = creditsUsed(countersPath, provider, now);
    if (used + cost > MONTHLY_CAP_CREDITS[provider]) {
      reasons.push(`${LABELS[provider]} has used its free credits for this month`);
      continue;
    }

    const adapter = ADAPTERS[provider];
    const apiKey = adapter.getKey();
    let items: TrendItem[];
    try {
      await paceSearch();
      items = await adapter.search(query, apiKey, fetchImpl);
    } catch (err) {
      if (!(err instanceof TrendError) || err.code === "missing_key") throw err;
      reasons.push(`${LABELS[provider]} did not answer (${err.message})`);
      continue;
    }
    addCredits(countersPath, provider, cost, now);
    return { provider, items };
  }

  throw new TrendError(
    "trend_unavailable",
    `Both free search services are out of credits or unavailable, so trend search cannot run. ` +
      `${reasons.join(". ")}. Trend mode stops for this session.`,
  );
}

export async function fetchTrendContext(
  topic: string,
  opts: TrendOptions = {},
): Promise<TrendContext> {
  if (!readSwitches().trend_mode) {
    return { skipped: true };
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? new Date();
  const countersPath = opts.countersPath ?? defaultCountersPath();

  const result = await runWithFallback(
    "trend",
    [{ role: "user", content: buildPrompt(topic) }],
    { fetchImpl },
  );
  const query = validateQuery(result.text);

  return withSearchLock(async () => {
    const found = await searchWithFallback(query, fetchImpl, countersPath, now);
    return { skipped: false as const, query, provider: found.provider, items: found.items };
  });
}

export function getSearchUsage(now: Date = new Date(), countersPath?: string): SearchUsage {
  const file = countersPath ?? defaultCountersPath();
  const usage = (provider: SearchProvider): ProviderUsage => {
    const used = creditsUsed(file, provider, now);
    const cap = MONTHLY_CAP_CREDITS[provider];
    return { used, cap, remaining: Math.max(0, cap - used) };
  };
  return { month: monthKey(now), tavily: usage("tavily"), firecrawl: usage("firecrawl") };
}
