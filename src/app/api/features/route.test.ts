import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/config/switches", () => ({
  readSwitches: vi.fn(),
  writeSwitches: vi.fn(),
}));

import { FEATURE_DEFAULTS } from "../../../lib/features/defaults";
import { readSwitches, writeSwitches } from "../../../lib/config/switches";
import { ConfigError } from "../../../lib/config/errors";
import { GET, PATCH } from "./route";

const LOCAL = { host: "127.0.0.1:3000" };
const EVIL = { host: "evil.example.com:3000" };

function patchReq(body: unknown, headers: Record<string, string> = LOCAL): Request {
  return new Request("http://127.0.0.1:3000/api/features", {
    method: "PATCH",
    headers: { ...headers, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function getReq(headers: Record<string, string> = LOCAL): Request {
  return new Request("http://127.0.0.1:3000/api/features", { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readSwitches).mockReturnValue({ ...FEATURE_DEFAULTS, variants: 3 } as never);
  vi.mocked(writeSwitches).mockImplementation((patch) => ({ ...FEATURE_DEFAULTS, ...patch }) as never);
});

describe("GET /api/features", () => {
  it("returns each switch with its default and current value", async () => {
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { switches: { key: string; default: unknown; current: unknown }[] };
    const variants = body.switches.find((s) => s.key === "variants");
    expect(variants).toEqual({ key: "variants", default: 2, current: 3 });
    expect(body.switches).toHaveLength(Object.keys(FEATURE_DEFAULTS).length);
  });

  it("returns 403 for a non-local host", async () => {
    const res = await GET(getReq(EVIL));
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/features", () => {
  it("returns 400 for an unknown key and writes nothing", async () => {
    const res = await PATCH(patchReq({ key: "not_a_switch", value: true }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("unknown_switch");
    expect(writeSwitches).not.toHaveBeenCalled();
  });

  it("refuses a key that only exists on the object prototype", async () => {
    const res = await PATCH(patchReq({ key: "constructor", value: true }));
    expect(res.status).toBe(400);
    expect(writeSwitches).not.toHaveBeenCalled();
  });

  it("writes one known switch through writeSwitches", async () => {
    const res = await PATCH(patchReq({ key: "trend_mode", value: true }));
    expect(res.status).toBe(200);
    expect(writeSwitches).toHaveBeenCalledWith({ trend_mode: true });
    expect(await res.json()).toEqual({ key: "trend_mode", value: true });
  });

  it("returns 400 when the schema rejects the value", async () => {
    vi.mocked(writeSwitches).mockImplementation(() => {
      throw new ConfigError("invalid_config", "bad value");
    });
    const res = await PATCH(patchReq({ key: "variants", value: "lots" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_value");
  });

  it("returns 400 for a body that is not JSON", async () => {
    const res = await PATCH(patchReq("{not json"));
    expect(res.status).toBe(400);
    expect(writeSwitches).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-local host and writes nothing", async () => {
    const res = await PATCH(patchReq({ key: "trend_mode", value: true }, EVIL));
    expect(res.status).toBe(403);
    expect(writeSwitches).not.toHaveBeenCalled();
  });
});
