import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSwitches } from "../../config/switches";
import { setLogSink } from "../../gateway/log";
import { resetPacingForTests } from "./request";
import { validateQuery, fetchTrendContext } from "./trend";
import { getSearchUsage } from "./trend";
import { TrendError } from "./errors";

// Switches are mocked, so the real config/features.json is never read or changed by these tests.
vi.mock("../../config/switches", () => ({ readSwitches: vi.fn() }));

const mockedSwitches = vi.mocked(readSwitches);
const FAKE_OPENROUTER = "sk-or-test-SECRET-111";
const FAKE_TAVILY = "tvly-test-SECRET-222";
const FAKE_FIRECRAWL = "fc-test-SECRET-333";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const TAVILY_URL = "https://api.tavily.com/search";
const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/search";
const MONTH = "2026-11";
const NOW = new Date("2026-11-15T10:00:00Z");

let logLines: string[] = [];
let tmpDir = "";
let countersPath = "";
let modelText = "india climate policy news";

function setTrendMode(on: boolean) {
  mockedSwitches.mockReturnValue({ trend_mode: on } as unknown as ReturnType<typeof readSwitches>);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function modelResponse(text: string): Response {
  return json({ choices: [{ message: { role: "assistant", content: text } }], usage: { total_tokens: 7 } });
}

function tavilyOk(): Response {
  return json({
    query: "x",
    results: [
      { url: "https://news.example.com/a", title: "First story", content: "PAGE TEXT ONE", score: 0.9 },
      { url: "not a url", title: "Bad url", content: "" },
      { url: "https://news.example.com/b", title: "Second story", content: "PAGE TEXT TWO" },
      { url: "https://news.example.com/c", title: "Third story", content: "" },
      { url: "https://news.example.com/d", title: "Fourth story", content: "" },
      { url: "https://news.example.com/e", title: "Fifth story", content: "" },
      { url: "https://news.example.com/f", title: "Sixth story", content: "" },
    ],
  });
}

function firecrawlOk(): Response {
  return json({
    success: true,
    data: {
      web: [
        { url: "https://fc.example.com/a", title: "FC one", description: "DESC ONE" },
        { url: "https://fc.example.com/b", title: "FC two", markdown: "PAGE MD" },
      ],
    },
  });
}

// Sends model calls to the reply, and search calls to the given responders.
function routedFetch(
  tavily: () => Response = tavilyOk,
  firecrawl: () => Response = firecrawlOk,
) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.startsWith(OPENROUTER_URL)) return modelResponse(modelText);
    if (url.startsWith(TAVILY_URL)) return tavily();
    if (url.startsWith(FIRECRAWL_URL)) return firecrawl();
    throw new Error("unexpected URL in test");
  });
}

const searchCalls = (fn: ReturnType<typeof vi.fn>) =>
  fn.mock.calls.filter((c) => {
    const url = String(c[0]);
    return url.startsWith(TAVILY_URL) || url.startsWith(FIRECRAWL_URL);
  });

function writeCounters(credits: { tavily?: number; firecrawl?: number }) {
  writeFileSync(
    countersPath,
    JSON.stringify({
      tavily: credits.tavily === undefined ? {} : { [MONTH]: { credits: credits.tavily } },
      firecrawl: credits.firecrawl === undefined ? {} : { [MONTH]: { credits: credits.firecrawl } },
    }),
  );
}

function readCountersFile() {
  return JSON.parse(readFileSync(countersPath, "utf8")) as {
    tavily: Record<string, { credits: number }>;
    firecrawl: Record<string, { credits: number }>;
  };
}

// Runs a promise while moving the fake clock forward, so paced waits can finish.
async function settle<T>(promise: Promise<T>): Promise<T> {
  let done = false;
  const tracked = promise.finally(() => {
    done = true;
  });
  tracked.catch(() => undefined);
  for (let i = 0; i < 20 && !done; i++) {
    await vi.advanceTimersByTimeAsync(1000);
  }
  return tracked;
}

beforeEach(() => {
  logLines = [];
  setLogSink({ write: (line) => logLines.push(line) });
  process.env.OPENROUTER_API_KEY = FAKE_OPENROUTER;
  process.env.TAVILY_API_KEY = FAKE_TAVILY;
  process.env.FIRECRAWL_API_KEY = FAKE_FIRECRAWL;
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "postline-trend-"));
  countersPath = path.join(tmpDir, "counters.json");
  modelText = "india climate policy news";
  vi.useFakeTimers({ now: NOW });
  resetPacingForTests();
  mockedSwitches.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.TAVILY_API_KEY;
  delete process.env.FIRECRAWL_API_KEY;
  rmSync(tmpDir, { recursive: true, force: true });
});

const allLogs = () => logLines.join("\n");

describe("trend mode switch", () => {
  it("returns skipped with zero fetch calls when trend_mode is off", async () => {
    setTrendMode(false);
    const fetchImpl = routedFetch();

    const result = await fetchTrendContext("india climate", { fetchImpl, countersPath, now: NOW });

    expect(result).toEqual({ skipped: true });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(existsSync(countersPath)).toBe(false);
  });
});

describe("provider routing", () => {
  it("uses Tavily when under cap, counts 1 credit, and returns url and title only", async () => {
    setTrendMode(true);
    const fetchImpl = routedFetch();

    const result = await settle(
      fetchTrendContext("india climate", { fetchImpl, countersPath, now: NOW }),
    );

    expect(result.skipped).toBe(false);
    if (result.skipped) return;
    expect(result.provider).toBe("tavily");
    expect(result.query).toBe("india climate policy news");
    expect(result.items).toHaveLength(5);
    expect(result.items[0]).toEqual({ url: "https://news.example.com/a", title: "First story" });
    expect(Object.keys(result.items[0]).sort()).toEqual(["title", "url"]);
    expect(allLogs()).not.toContain("PAGE TEXT");

    const [call] = searchCalls(fetchImpl);
    const init = (call[1] ?? {}) as RequestInit;
    expect(String(call[0])).toBe(TAVILY_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${FAKE_TAVILY}`);
    expect(JSON.parse(String(init.body))).toMatchObject({ search_depth: "basic", max_results: 5 });

    expect(readCountersFile().tavily[MONTH]).toEqual({ credits: 1 });
    expect(readCountersFile().firecrawl).toEqual({});
  });

  it("uses Firecrawl when Tavily is at its cap, and counts 2 credits", async () => {
    setTrendMode(true);
    writeCounters({ tavily: 900 });
    const fetchImpl = routedFetch();

    const result = await settle(
      fetchTrendContext("india climate", { fetchImpl, countersPath, now: NOW }),
    );

    expect(result.skipped).toBe(false);
    if (result.skipped) return;
    expect(result.provider).toBe("firecrawl");
    expect(result.items).toEqual([
      { url: "https://fc.example.com/a", title: "FC one" },
      { url: "https://fc.example.com/b", title: "FC two" },
    ]);
    expect(searchCalls(fetchImpl).map((c) => String(c[0]))).toEqual([FIRECRAWL_URL]);
    const [, init] = searchCalls(fetchImpl)[0];
    expect((init as RequestInit).headers).toMatchObject({ Authorization: `Bearer ${FAKE_FIRECRAWL}` });
    expect(readCountersFile().firecrawl[MONTH]).toEqual({ credits: 2 });
    expect(readCountersFile().tavily[MONTH]).toEqual({ credits: 900 });
  });

  it("falls back to Firecrawl when Tavily returns 429, and does not count the failed call", async () => {
    setTrendMode(true);
    const fetchImpl = routedFetch(() => new Response("slow down", { status: 429 }));

    const result = await settle(
      fetchTrendContext("india climate", { fetchImpl, countersPath, now: NOW }),
    );

    expect(result.skipped).toBe(false);
    if (result.skipped) return;
    expect(result.provider).toBe("firecrawl");
    expect(searchCalls(fetchImpl).map((c) => String(c[0]))).toEqual([TAVILY_URL, FIRECRAWL_URL]);
    expect(readCountersFile().tavily).toEqual({});
    expect(readCountersFile().firecrawl[MONTH]).toEqual({ credits: 2 });
  });

  it("throws trend_unavailable with no search call when both providers are at cap", async () => {
    setTrendMode(true);
    writeCounters({ tavily: 900, firecrawl: 900 });
    const fetchImpl = routedFetch();

    const error = await settle(
      fetchTrendContext("india climate", { fetchImpl, countersPath, now: NOW }).catch((e) => e),
    );

    expect(error).toBeInstanceOf(TrendError);
    expect((error as TrendError).code).toBe("trend_unavailable");
    expect((error as TrendError).message).toContain("out of credits or unavailable");
    expect((error as TrendError).message).toContain("Trend mode stops for this session");
    expect(searchCalls(fetchImpl)).toHaveLength(0);
  });

  it("throws trend_unavailable when Tavily fails and Firecrawl is at cap", async () => {
    setTrendMode(true);
    writeCounters({ firecrawl: 900 });
    const fetchImpl = routedFetch(() => new Response("boom", { status: 500 }));

    const error = await settle(
      fetchTrendContext("india climate", { fetchImpl, countersPath, now: NOW }).catch((e) => e),
    );

    expect((error as TrendError).code).toBe("trend_unavailable");
    expect(searchCalls(fetchImpl)).toHaveLength(1);
  });
});

describe("keys", () => {
  it("throws missing_key with the key name only, and never prints the other key value", async () => {
    setTrendMode(true);
    delete process.env.TAVILY_API_KEY;
    const fetchImpl = routedFetch();

    const error = await settle(
      fetchTrendContext("india climate", { fetchImpl, countersPath, now: NOW }).catch((e) => e),
    );

    expect((error as TrendError).code).toBe("missing_key");
    expect((error as TrendError).key).toBe("TAVILY_API_KEY");
    expect((error as Error).message).toContain("TAVILY_API_KEY");
    expect((error as Error).message).not.toContain(FAKE_FIRECRAWL);
    expect(allLogs()).not.toContain(FAKE_FIRECRAWL);
    expect(searchCalls(fetchImpl)).toHaveLength(0);
  });

  it("never puts a key value in a log line or an error message, even on a 500", async () => {
    setTrendMode(true);
    const fetchImpl = routedFetch(
      () => new Response("boom", { status: 500 }),
      () => new Response("boom", { status: 500 }),
    );

    const error = await settle(
      fetchTrendContext("india climate", { fetchImpl, countersPath, now: NOW }).catch((e) => e),
    );

    expect((error as TrendError).code).toBe("trend_unavailable");
    expect(allLogs()).toContain('"provider":"tavily"');
    expect(allLogs()).toContain('"provider":"firecrawl"');
    for (const secret of [FAKE_OPENROUTER, FAKE_TAVILY, FAKE_FIRECRAWL]) {
      expect((error as Error).message).not.toContain(secret);
      expect(allLogs()).not.toContain(secret);
    }
  });
});

describe("pacing", () => {
  it("paces two calls in the same tick so the second waits 1000 ms", async () => {
    setTrendMode(true);
    const times: number[] = [];
    const fetchImpl = routedFetch();
    const timed = vi.fn(async (input: string | URL | Request) => {
      if (String(input).startsWith(TAVILY_URL)) times.push(Date.now());
      return fetchImpl(input);
    });

    const first = settle(fetchTrendContext("india climate", { fetchImpl: timed, countersPath, now: NOW }));
    const second = settle(fetchTrendContext("india climate", { fetchImpl: timed, countersPath, now: NOW }));
    await Promise.all([first, second]);

    expect(times).toHaveLength(2);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(1000);
  });
});

describe("counter file", () => {
  it("is valid JSON in credits and survives a second call in the same month", async () => {
    setTrendMode(true);
    const fetchImpl = routedFetch();
    const options = { fetchImpl, countersPath, now: NOW };

    await settle(fetchTrendContext("india climate", options));
    await settle(fetchTrendContext("india climate", options));

    const saved = readCountersFile();
    expect(saved.tavily[MONTH]).toEqual({ credits: 2 });
    expect(saved.firecrawl).toEqual({});
  });
});

describe("getSearchUsage", () => {
  it("reports month and both providers in credits", () => {
    writeCounters({ tavily: 12, firecrawl: 4 });

    expect(getSearchUsage(NOW, countersPath)).toEqual({
      month: MONTH,
      tavily: { used: 12, cap: 900, remaining: 888 },
      firecrawl: { used: 4, cap: 900, remaining: 896 },
    });
  });

  it("reports zero when no counter file exists yet", () => {
    expect(getSearchUsage(NOW, countersPath)).toEqual({
      month: MONTH,
      tavily: { used: 0, cap: 900, remaining: 900 },
      firecrawl: { used: 0, cap: 900, remaining: 900 },
    });
  });
});

describe("validateQuery", () => {
  it("accepts 3 to 6 plain words", () => {
    expect(validateQuery("  india climate policy news  ")).toBe("india climate policy news");
  });

  it("rejects a query with quote marks, or fewer than 3 words", () => {
    expect(() => validateQuery('"india climate" news')).toThrow(TrendError);
    expect(() => validateQuery("india news")).toThrow(TrendError);
  });
});
