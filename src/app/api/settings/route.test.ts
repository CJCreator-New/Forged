import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/config/switches", () => ({
  readSwitches: vi.fn(),
}));
vi.mock("../../../lib/pipeline/trend/trend", () => ({
  getBraveUsage: vi.fn(),
}));

import { FEATURE_DEFAULTS } from "../../../lib/features/defaults";
import { readSwitches } from "../../../lib/config/switches";
import { getBraveUsage } from "../../../lib/pipeline/trend/trend";
import { GET } from "./route";

const FAKE_KEY = "sk-or-test-FAKE-VALUE-9f3a71";

function req(headers: Record<string, string> = { host: "127.0.0.1:3000" }): Request {
  return new Request("http://127.0.0.1:3000/api/settings", { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readSwitches).mockReturnValue({ ...FEATURE_DEFAULTS } as never);
  vi.mocked(getBraveUsage).mockReturnValue({ month: "2026-11", used: 12, cap: 900, remaining: 888 });
});

afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.BRAVE_API_KEY;
});

describe("GET /api/settings", () => {
  it("never contains the value of the OpenRouter key", async () => {
    process.env.OPENROUTER_API_KEY = FAKE_KEY;
    process.env.BRAVE_API_KEY = FAKE_KEY + "-brave";
    const res = await GET(req());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(FAKE_KEY);
    const body = JSON.parse(text) as { keys: { name: string; set: boolean }[] };
    expect(body.keys).toEqual([
      { name: "OPENROUTER_API_KEY", set: true },
      { name: "BRAVE_API_KEY", set: true },
    ]);
  });

  it("reports a key as not set when it is missing or blank", async () => {
    process.env.OPENROUTER_API_KEY = "   ";
    const res = await GET(req());
    const body = (await res.json()) as { keys: { name: string; set: boolean }[] };
    expect(body.keys.find((k) => k.name === "OPENROUTER_API_KEY")?.set).toBe(false);
    expect(body.keys.find((k) => k.name === "BRAVE_API_KEY")?.set).toBe(false);
  });

  it("shows null for Brave usage when it cannot be read", async () => {
    vi.mocked(getBraveUsage).mockImplementation(() => {
      throw new Error("unreadable");
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { counters: { brave_month: unknown }; brave_cap: number };
    expect(body.counters.brave_month).toBeNull();
    expect(body.brave_cap).toBe(900);
  });

  it("returns 403 for a non-local host", async () => {
    const res = await GET(req({ host: "evil.example.com:3000" }));
    expect(res.status).toBe(403);
  });
});
