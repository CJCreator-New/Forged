import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../lib/gateway/keyStatus", () => ({
  checkKey: vi.fn(),
}));

import { checkKey } from "../../../../lib/gateway/keyStatus";
import { GatewayError } from "../../../../lib/gateway/errors";
import { POST } from "./route";

function req(body: unknown, headers: Record<string, string> = { host: "127.0.0.1:3000" }): Request {
  return new Request("http://127.0.0.1:3000/api/keys/check", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/keys/check", () => {
  it("maps the key status to the contract shape", async () => {
    vi.mocked(checkKey).mockResolvedValue({ valid: true, isFreeTier: true, limitRemaining: 4.2 });
    const res = await POST(req({ provider: "openrouter" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: true, is_free_tier: true, limit_remaining: 4.2 });
  });

  it("passes a missing key through with its name", async () => {
    vi.mocked(checkKey).mockRejectedValue(
      new GatewayError("missing_key", "OPENROUTER_API_KEY is not set.", { key: "OPENROUTER_API_KEY" }),
    );
    const res = await POST(req({ provider: "openrouter" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; key: string } };
    expect(body.error.code).toBe("missing_key");
    expect(body.error.key).toBe("OPENROUTER_API_KEY");
  });

  it("refuses a provider it does not check", async () => {
    const res = await POST(req({ provider: "brave" }));
    expect(res.status).toBe(400);
    expect(checkKey).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-local host and does not call the provider", async () => {
    const res = await POST(req({ provider: "openrouter" }, { host: "evil.example.com:3000" }));
    expect(res.status).toBe(403);
    expect(checkKey).not.toHaveBeenCalled();
  });
});
