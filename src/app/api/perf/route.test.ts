import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { testDir } = vi.hoisted(() => ({ testDir: `_test_${Math.random().toString(36).slice(2, 10)}` }));

vi.mock("./logPath", () => ({ LOG_PATH: `${testDir}/log.md` }));
vi.mock("../../../lib/config/switches", () => ({ readSwitches: vi.fn() }));

import type { LogRow } from "../../../lib/schemas/log";
import { readSwitches } from "../../../lib/config/switches";
import { readLogRows, saveLogRows } from "./logFile";
import { DELETE, GET } from "./route";

const ON = { performance_loop: { enabled: true, min_posts: 20, min_group: 3 } };
const ROOT = path.resolve(process.cwd(), "content", testDir);

function row(i: number, overrides: Partial<LogRow> = {}): LogRow {
  return {
    date: "2026-11-01",
    post_id: `p-${String(i).padStart(3, "0")}`,
    channel: "linkedin",
    topic: "AI",
    format: "carousel",
    length: "medium",
    variant: 1,
    minutes: null,
    edit_rating: "as-is",
    reach: 1000,
    followers: 10,
    ...overrides,
  };
}

function req(method: string, body?: unknown): Request {
  return new Request("http://127.0.0.1:3000/api/perf", {
    method,
    headers: { host: "127.0.0.1:3000", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readSwitches).mockReturnValue(ON as never);
});

afterEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true });
});

describe("GET /api/perf", () => {
  it("is unranked with one more needed when 19 posts have reach", async () => {
    const rows = Array.from({ length: 19 }, (_, i) => row(i + 1));
    await saveLogRows(rows, `${testDir}/log.md`);

    const res = await GET(req("GET"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ranked).toBe(false);
    expect(body.needed).toBe(1);
    expect(body.logged).toBe(19);
    expect(body.threshold).toBe(20);
  });

  it("returns a ranked list with a plain reason once the threshold is met", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => row(i + 1, { reach: 1200 }));
    await saveLogRows(rows, `${testDir}/log.md`);

    const body = await (await GET(req("GET"))).json();

    expect(body.needed).toBe(0);
    expect(body.ranked).toHaveLength(1);
    expect(body.ranked[0].reason).toBe("your last 20 carousel posts on AI averaged 1,200 reach");
  });

  it("treats a missing log as empty", async () => {
    const body = await (await GET(req("GET"))).json();
    expect(body.logged).toBe(0);
    expect(body.needed).toBe(20);
  });

  it("returns only enabled false, with no computation, when the loop is switched off", async () => {
    vi.mocked(readSwitches).mockReturnValue({ performance_loop: { enabled: false, min_posts: 20, min_group: 3 } } as never);
    const rows = Array.from({ length: 25 }, (_, i) => row(i + 1));
    await saveLogRows(rows, `${testDir}/log.md`);

    const body = await (await GET(req("GET"))).json();

    expect(body).toEqual({ enabled: false });
  });

  it("refuses a request that is not from this app", async () => {
    const res = await GET(
      new Request("http://evil.example/api/perf", { headers: { host: "evil.example" } }),
    );
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/perf", () => {
  it("refuses without confirm true and changes nothing", async () => {
    await saveLogRows([row(1)], `${testDir}/log.md`);

    const res = await DELETE(req("DELETE", {}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("confirm_required");
    expect((await readLogRows(`${testDir}/log.md`))[0].reach).toBe(1000);
  });

  it("clears reach and followers and keeps every row", async () => {
    const rows = [row(1), row(2, { reach: null, followers: null }), row(3, { followers: 99 })];
    await saveLogRows(rows, `${testDir}/log.md`);

    const res = await DELETE(req("DELETE", { confirm: true }));
    expect(await res.json()).toEqual({ cleared: true });

    const after = await readLogRows(`${testDir}/log.md`);
    expect(after.map((r) => r.post_id)).toEqual(["p-001", "p-002", "p-003"]);
    expect(after.every((r) => r.reach === null && r.followers === null)).toBe(true);
    expect(after[0].topic).toBe("AI");
  });

  it("succeeds with nothing to clear when there is no log yet", async () => {
    const res = await DELETE(req("DELETE", { confirm: true }));
    expect(res.status).toBe(200);
    await expect(fs.access(path.join(ROOT, "log.md"))).rejects.toThrow();
  });
});
