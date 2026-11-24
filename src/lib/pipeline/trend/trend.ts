// Trend search: one model call writes a search query, then one Brave call fetches up to 5 links.
// Off unless the trend_mode switch is on. Stops with a plain reason when it fails or hits the monthly cap.
import { readSwitches } from "../../config/switches";
import { runWithFallback } from "../../gateway/fallback";
import { TrendError } from "./errors";
import {
  BRAVE_MONTHLY_CAP,
  defaultCountersPath,
  incrementBraveCount,
  monthKey,
  usedThisMonth,
} from "./counter";
import { callBrave, getBraveKey, paceBrave, type TrendItem } from "./brave";

export type TrendOptions = {
  fetchImpl?: typeof fetch;
  now?: Date;
  // Tests point this at a temp file. The app uses config/counters.json.
  countersPath?: string;
};

export type TrendContext =
  | { skipped: true }
  | { skipped: false; query: string; items: TrendItem[] };

export type BraveUsage = {
  month: string;
  used: number;
  cap: typeof BRAVE_MONTHLY_CAP;
  remaining: number;
};

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

// Brave calls run one at a time, so the monthly cap check and the count update cannot race.
let braveLock: Promise<unknown> = Promise.resolve();
function withBraveLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = braveLock.then(fn);
  braveLock = run.catch(() => undefined);
  return run;
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
  const braveKey = getBraveKey();

  const result = await runWithFallback(
    "trend",
    [{ role: "user", content: buildPrompt(topic) }],
    { fetchImpl },
  );
  const query = validateQuery(result.text);

  return withBraveLock(async () => {
    if (usedThisMonth(countersPath, now) >= BRAVE_MONTHLY_CAP) {
      throw new TrendError(
        "brave_cap_reached",
        `The monthly cap of ${BRAVE_MONTHLY_CAP} trend searches was reached. Trend mode stops until next month.`,
      );
    }
    await paceBrave();
    const items = await callBrave(query, braveKey, fetchImpl);
    incrementBraveCount(countersPath, now);
    return { skipped: false as const, query, items };
  });
}

export function getBraveUsage(now: Date = new Date(), countersPath?: string): BraveUsage {
  const file = countersPath ?? defaultCountersPath();
  const used = usedThisMonth(file, now);
  return {
    month: monthKey(now),
    used,
    cap: BRAVE_MONTHLY_CAP,
    remaining: Math.max(0, BRAVE_MONTHLY_CAP - used),
  };
}
