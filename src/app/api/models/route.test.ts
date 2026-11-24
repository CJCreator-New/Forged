import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/gateway/models", () => ({
  fetchModels: vi.fn(),
}));

import { fetchModels } from "../../../lib/gateway/models";
import { GatewayError } from "../../../lib/gateway/errors";
import { GET } from "./route";

function req(headers: Record<string, string> = { host: "127.0.0.1:3000" }): Request {
  return new Request("http://127.0.0.1:3000/api/models", { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENROUTER_API_KEY = "sk-or-test-models";
});

afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
});

describe("GET /api/models", () => {
  it("returns the fetch time and the models with free ones marked", async () => {
    vi.mocked(fetchModels).mockResolvedValue([{ id: "a/free:free", name: "Free one", free: true }]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { fetched_at: string; models: unknown[] };
    expect(typeof body.fetched_at).toBe("string");
    expect(Number.isNaN(Date.parse(body.fetched_at))).toBe(false);
    expect(body.models).toEqual([{ id: "a/free:free", name: "Free one", free: true }]);
  });

  it("returns missing_key with the key name and does not fetch when the key is not set", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const res = await GET(req());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; key: string } };
    expect(body.error.code).toBe("missing_key");
    expect(body.error.key).toBe("OPENROUTER_API_KEY");
    expect(fetchModels).not.toHaveBeenCalled();
  });

  it("maps a gateway timeout to 502", async () => {
    vi.mocked(fetchModels).mockRejectedValue(new GatewayError("timeout", "Took too long."));
    const res = await GET(req());
    expect(res.status).toBe(502);
  });

  it("returns 403 for a non-local host and does not fetch", async () => {
    const res = await GET(req({ host: "evil.example.com:3000" }));
    expect(res.status).toBe(403);
    expect(fetchModels).not.toHaveBeenCalled();
  });
});
