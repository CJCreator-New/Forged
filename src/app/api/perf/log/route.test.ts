import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { testDir } = vi.hoisted(() => ({ testDir: `_test_${Math.random().toString(36).slice(2, 10)}` }));

vi.mock("../logPath", () => ({ LOG_PATH: `${testDir}/log.md` }));

import type { LogRow } from "../../../../lib/schemas/log";
import { readLogRows, saveLogRows } from "../logFile";
import { POST } from "./route";

const ROOT = path.resolve(process.cwd(), "content", testDir);

function row(overrides: Partial<LogRow> = {}): LogRow {
  return {
    date: "2026-11-01",
    post_id: "p-001",
    channel: "linkedin",
    topic: "AI",
    format: "carousel",
    length: "medium",
    variant: 1,
    minutes: 10,
    edit_rating: "light",
    reach: null,
    followers: null,
    ...overrides,
  };
}

function req(body: unknown): Request {
  return new Request("http://127.0.0.1:3000/api/perf/log", {
    method: "POST",
    headers: { host: "127.0.0.1:3000", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await saveLogRows([row()], `${testDir}/log.md`);
});

afterEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true });
});

describe("POST /api/perf/log", () => {
  it("appends a new row and keeps the existing ones", async () => {
    const res = await POST(req({ row: row({ post_id: "p-002", topic: "Ops" }) }));
    expect(await res.json()).toEqual({ appended: true });

    const rows = await readLogRows(`${testDir}/log.md`);
    expect(rows.map((r) => r.post_id)).toEqual(["p-001", "p-002"]);
  });

  it("refuses a post ID that is already logged, without overwriting it", async () => {
    const res = await POST(req({ row: row({ topic: "Changed" }) }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("duplicate_post_id");
    expect((await readLogRows(`${testDir}/log.md`))[0].topic).toBe("AI");
  });

  it("with replace true changes only reach and followers on the matching post", async () => {
    const res = await POST(req({ row: row({ reach: 1500, followers: 30 }), replace: true }));
    expect(await res.json()).toEqual({ replaced: true });

    const [after] = await readLogRows(`${testDir}/log.md`);
    expect(after.reach).toBe(1500);
    expect(after.followers).toBe(30);
    expect(after.topic).toBe("AI");
    expect(after.edit_rating).toBe("light");
  });

  it("with replace true refuses a change to topic", async () => {
    const res = await POST(req({ row: row({ topic: "Hiring", reach: 900 }), replace: true }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("row_change_refused");

    const [after] = await readLogRows(`${testDir}/log.md`);
    expect(after.topic).toBe("AI");
    expect(after.reach).toBe(null);
  });

  it("with replace true returns 404 for an unknown post", async () => {
    const res = await POST(req({ row: row({ post_id: "missing" }), replace: true }));
    expect(res.status).toBe(404);
  });

  it("refuses a row that fails the log schema", async () => {
    const res = await POST(req({ row: row({ channel: "myspace" as never }) }));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("invalid_row");
  });

  it("refuses a request that is not from this app", async () => {
    const res = await POST(
      new Request("http://evil.example/api/perf/log", {
        method: "POST",
        headers: { host: "evil.example" },
        body: JSON.stringify({ row: row() }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
