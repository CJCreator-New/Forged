import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/config/switches", () => ({
  readSwitches: vi.fn(),
}));
vi.mock("../../../lib/pipeline/trend/trend", () => ({
  getSearchUsage: vi.fn(),
}));

import { FEATURE_DEFAULTS } from "../../../lib/features/defaults";
import { readSwitches } from "../../../lib/config/switches";
import { getSearchUsage } from "../../../lib/pipeline/trend/trend";
import { GET } from "./route";

const FAKE_KEY = "sk-or-test-FAKE-VALUE-9f3a71";

function req(headers: Record<string, string> = { host: "127.0.0.1:3000" }): Request {
  return new Request("http://127.0.0.1:3000/api/settings", { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readSwitches).mockReturnValue({ ...FEATURE_DEFAULTS } as never);
  vi.mocked(getSearchUsage).mockReturnValue({
    month: "2026-11",
    tavily: { used: 12, cap: 900, remaining: 888 },
    firecrawl: { used: 0, cap: 900, remaining: 900 },
  });
});

afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.TAVILY_API_KEY;
  delete process.env.FIRECRAWL_API_KEY;
});

describe("GET /api/settings", () => {
  it("never contains the value of any key", async () => {
    process.env.OPENROUTER_API_KEY = FAKE_KEY;
    process.env.TAVILY_API_KEY = FAKE_KEY + "-tavily";
    process.env.FIRECRAWL_API_KEY = FAKE_KEY + "-firecrawl";
    const res = await GET(req());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(FAKE_KEY);
    const body = JSON.parse(text) as { keys: { name: string; set: boolean }[] };
    expect(body.keys).toEqual([
      { name: "OPENROUTER_API_KEY", set: true },
      { name: "TAVILY_API_KEY", set: true },
      { name: "FIRECRAWL_API_KEY", set: true },
    ]);
  });

  it("reports a key as not set when it is missing or blank", async () => {
    process.env.OPENROUTER_API_KEY = "   ";
    const res = await GET(req());
    const body = (await res.json()) as { keys: { name: string; set: boolean }[] };
    expect(body.keys.find((k) => k.name === "OPENROUTER_API_KEY")?.set).toBe(false);
    expect(body.keys.find((k) => k.name === "TAVILY_API_KEY")?.set).toBe(false);
  });

  it("shows search usage per service, and null when it cannot be read", async () => {
    const res = await GET(req());
    const body = (await res.json()) as {
      counters: { search_month: { tavily: { cap: number } } | null };
    };
    expect(body.counters.search_month?.tavily.cap).toBe(900);

    vi.mocked(getSearchUsage).mockImplementation(() => {
      throw new Error("unreadable");
    });
    const res2 = await GET(req());
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { counters: { search_month: unknown } };
    expect(body2.counters.search_month).toBeNull();
  });

  it("returns 403 for a non-local host", async () => {
    const res = await GET(req({ host: "evil.example.com:3000" }));
    expect(res.status).toBe(403);
  });
});
