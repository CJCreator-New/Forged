import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSwitches } from "../../config/switches";
import { setLogSink } from "../../gateway/log";
import { resetBravePacingForTests } from "./brave";
import { fetchTrendContext, getBraveUsage } from "./trend";

// Switches are mocked, so the real config/features.json is never read or changed by these tests.
vi.mock("../../config/switches", () => ({ readSwitches: vi.fn() }));

const mockedSwitches = vi.mocked(readSwitches);
const FAKE_OPENROUTER = "sk-or-test-SECRET-111";
const FAKE_BRAVE = "brave-test-SECRET-222";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const BRAVE_PREFIX = "https://api.search.brave.com/res/v1/web/search";

let logLines: string[] = [];
let tmpDir = "";
let countersPath = "";
let modelText = "india climate policy news";

function setTrendMode(on: boolean) {
  mockedSwitches.mockReturnValue({ trend_mode: on } as unknown as ReturnType<typeof readSwitches>);
}

function modelResponse(text: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }], usage: { total_tokens: 7 } }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function braveOk(): Response {
  return new Response(
    JSON.stringify({
      web: {
        results: [
          { url: "https://news.example.com/a", title: "First story", description: "SNIPPET ONE" },
          { url: "not a url", title: "Bad url" },
          { url: "https://news.example.com/b", title: "Second story", extra_snippets: ["SNIPPET TWO"] },
          { url: "https://news.example.com/c", title: "Third story" },
          { url: "https://news.example.com/d", title: "Fourth story" },
          { url: "https://news.example.com/e", title: "Fifth story" },
          { url: "https://news.example.com/f", title: "Sixth story" },
        ],
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// Sends OpenRouter calls to the model reply and Brave calls to the given response factory.
function routedFetch(brave: () => Response = braveOk) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.startsWith(OPENROUTER_URL)) return modelResponse(modelText);
    if (url.startsWith(BRAVE_PREFIX)) return brave();
    throw new Error("unexpected URL in test");
  });
}

const braveCalls = (fn: ReturnType<typeof vi.fn>) =>
  fn.mock.calls.filter((c) => String(c[0]).startsWith(BRAVE_PREFIX));

// Runs a promise while moving the fake clock forward, so paced waits can finish.
async function settle<T>(promise: Promise<T>): Promise<T> {
  let done = false;
  const tracked = promise.finally(() => {
    done = true;
  });
  // Mark as handled now, so a rejection that lands during the loop is not reported as unhandled.
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
  process.env.BRAVE_API_KEY = FAKE_BRAVE;
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "postline-trend-"));
  countersPath = path.join(tmpDir, "counters.json");
  modelText = "india climate policy news";
  vi.useFakeTimers();
  resetBravePacingForTests();
  mockedSwitches.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.BRAVE_API_KEY;
  rmSync(tmpDir, { recursive: true, force: true });
});

const allLogs = () => logLines.join("\n");

describe("trend mode switch", () => {
  it("returns skipped with zero fetch calls when trend_mode is off", async () => {
    setTrendMode(false);
    const fetchImpl = routedFetch();

    const result = await fetchTrendContext("india climate", { fetchImpl, countersPath });

    expect(result).toEqual({ skipped: true });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(existsSync(countersPath)).toBe(false);
  });
});

describe("fetchTrendContext", () => {
  it("returns url and title only, at most 5 items, and counts one search", async () => {
    setTrendMode(true);
    const fetchImpl = routedFetch();
    const now = new Date("2026-11-10T09:00:00Z");

    const result = await settle(fetchTrendContext("india climate", { fetchImpl, countersPath, now }));

    expect(result.skipped).toBe(false);
    if (result.skipped) return;
    expect(result.query).toBe("india climate policy news");
    expect(result.items).toEqual([
      { url: "https://news.example.com/a", title: "First story" },
      { url: "https://news.example.com/b", title: "Second story" },
      { url: "https://news.example.com/c", title: "Third story" },
      { url: "https://news.example.com/d", title: "Fourth story" },
      { url: "https://news.example.com/e", title: "Fifth story" },
    ]);
    for (const item of result.items) {
      expect(Object.keys(item).sort()).toEqual(["title", "url"]);
    }
    expect(allLogs()).not.toContain("SNIPPET");

    const braveUrl = String(braveCalls(fetchImpl)[0][0]);
    expect(braveUrl).toContain("q=india+climate+policy+news");
    expect(braveUrl).toContain("count=5");
    const braveInit = braveCalls(fetchImpl)[0][1] as RequestInit;
    expect((braveInit.headers as Record<string, string>)["X-Subscription-Token"]).toBe(FAKE_BRAVE);

    expect(getBraveUsage(now, countersPath).used).toBe(1);
    expect(logLines.some((l) => l.includes('"provider":"brave"'))).toBe(true);
    expect(logLines.some((l) => l.includes('"provider":"openrouter"'))).toBe(true);
  });

  it("blocks the call at the monthly cap without calling Brave", async () => {
    setTrendMode(true);
    const now = new Date("2026-11-10T09:00:00Z");
    writeFileSync(countersPath, JSON.stringify({ brave: { "2026-11": 900 } }));
    const fetchImpl = routedFetch();

    await expect(settle(fetchTrendContext("india climate", { fetchImpl, countersPath, now }))).rejects.toMatchObject({
      code: "brave_cap_reached",
    });
    expect(braveCalls(fetchImpl)).toHaveLength(0);
  });

  it("paces two calls in the same tick so the second waits 1000 ms", async () => {
    setTrendMode(true);
    const fetchImpl = routedFetch();
    const now = new Date("2026-11-10T09:00:00Z");

    const first = fetchTrendContext("india climate", { fetchImpl, countersPath, now });
    const second = fetchTrendContext("india climate", { fetchImpl, countersPath, now });

    await vi.advanceTimersByTimeAsync(0);
    expect(braveCalls(fetchImpl)).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(braveCalls(fetchImpl)).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(braveCalls(fetchImpl)).toHaveLength(2);

    await Promise.all([first, second]);
    expect(getBraveUsage(now, countersPath).used).toBe(2);
  });

  it("throws missing_key with the key name only when BRAVE_API_KEY is unset", async () => {
    setTrendMode(true);
    delete process.env.BRAVE_API_KEY;
    const fetchImpl = routedFetch();

    let caught: unknown;
    try {
      await settle(fetchTrendContext("india climate", { fetchImpl, countersPath }));
    } catch (err) {
      caught = err;
    }

    expect(caught).toMatchObject({ code: "missing_key", key: "BRAVE_API_KEY" });
    expect(String((caught as Error).message)).toContain("BRAVE_API_KEY");
    expect(String((caught as Error).message)).not.toContain(FAKE_BRAVE);
    expect(allLogs()).not.toContain(FAKE_BRAVE);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never puts the Brave key value in the error or the log", async () => {
    setTrendMode(true);
    const fetchImpl = routedFetch(() => new Response("echo " + FAKE_BRAVE, { status: 500 }));

    let caught: unknown;
    try {
      await settle(fetchTrendContext("india climate", { fetchImpl, countersPath }));
    } catch (err) {
      caught = err;
    }

    expect(caught).toMatchObject({ code: "brave_error", status: 500 });
    expect(String((caught as Error).message)).not.toContain(FAKE_BRAVE);
    expect(allLogs()).not.toContain(FAKE_BRAVE);
    expect(allLogs()).not.toContain(FAKE_OPENROUTER);
  });

  it("returns brave_error with the status only on a non-200 response", async () => {
    setTrendMode(true);
    const fetchImpl = routedFetch(() => new Response("{}", { status: 429 }));
    const now = new Date("2026-11-10T09:00:00Z");

    let caught: unknown;
    try {
      await settle(fetchTrendContext("india climate", { fetchImpl, countersPath, now }));
    } catch (err) {
      caught = err;
    }

    expect(caught).toMatchObject({ code: "brave_error", status: 429 });
    expect((caught as Error).message).toBe("Brave Search returned HTTP 429.");
    expect(getBraveUsage(now, countersPath).used).toBe(0);
  });

  it("rejects a query that is not 3 to 6 words, or has quotes, without calling Brave", async () => {
    setTrendMode(true);
    modelText = '"two words"';
    const fetchImpl = routedFetch();

    await expect(
      settle(fetchTrendContext("india climate", { fetchImpl, countersPath })),
    ).rejects.toMatchObject({ code: "bad_query" });
    expect(braveCalls(fetchImpl)).toHaveLength(0);
  });
});

describe("counter file", () => {
  it("is created as valid JSON and survives a second call in the same month", async () => {
    setTrendMode(true);
    const fetchImpl = routedFetch();
    const now = new Date("2026-11-10T09:00:00Z");
    expect(existsSync(countersPath)).toBe(false);

    await settle(fetchTrendContext("india climate", { fetchImpl, countersPath, now }));
    const afterFirst = JSON.parse(readFileSync(countersPath, "utf8"));
    expect(afterFirst).toEqual({ brave: { "2026-11": 1 } });

    await settle(fetchTrendContext("india climate", { fetchImpl, countersPath, now }));
    const afterSecond = JSON.parse(readFileSync(countersPath, "utf8"));
    expect(afterSecond).toEqual({ brave: { "2026-11": 2 } });
  });

  it("keys the count by UTC month", async () => {
    setTrendMode(true);
    writeFileSync(countersPath, JSON.stringify({ brave: { "2026-10": 900 } }));
    const fetchImpl = routedFetch();
    const now = new Date("2026-11-01T00:30:00Z");

    await settle(fetchTrendContext("india climate", { fetchImpl, countersPath, now }));

    expect(JSON.parse(readFileSync(countersPath, "utf8"))).toEqual({ brave: { "2026-10": 900, "2026-11": 1 } });
  });
});

describe("getBraveUsage", () => {
  it("reports month, used, cap and remaining", () => {
    writeFileSync(countersPath, JSON.stringify({ brave: { "2026-11": 40 } }));
    expect(getBraveUsage(new Date("2026-11-20T12:00:00Z"), countersPath)).toEqual({
      month: "2026-11",
      used: 40,
      cap: 900,
      remaining: 860,
    });
  });

  it("reports zero when no counter file exists yet", () => {
    expect(getBraveUsage(new Date("2026-11-20T12:00:00Z"), countersPath)).toEqual({
      month: "2026-11",
      used: 0,
      cap: 900,
      remaining: 900,
    });
  });
});
