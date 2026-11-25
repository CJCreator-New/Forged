import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/pipeline", () => ({
  generateAngles: vi.fn(),
  draftDaily: vi.fn(async () => ({ results: [{ platform: "linkedin", path: "daily/x.md", passed: true }] })),
}));

vi.mock("../../../lib/store/posts", () => ({
  readPost: vi.fn(async () => ({ path: "p", data: {}, body: "Draft text" })),
}));

import { draftDaily } from "../../../lib/pipeline";
import { POST } from "./route";

const req = (body: unknown, headers: Record<string, string> = { host: "localhost:3000" }) =>
  new Request("http://localhost:3000/api/draft", { method: "POST", headers, body: JSON.stringify(body) });

const good = { date: "2026-11-25", topic: "t", angle: "a" };

beforeEach(() => vi.mocked(draftDaily).mockClear());

describe("POST /api/draft", () => {
  it("rejects non-local requests", async () => {
    expect((await POST(req(good, { host: "evil.com" }))).status).toBe(403);
    expect(draftDaily).not.toHaveBeenCalled();
  });
  it("rejects a bad date", async () => {
    expect((await POST(req({ ...good, date: "2026-02-30" }))).status).toBe(400);
    expect((await POST(req({ ...good, date: "../x" }))).status).toBe(400);
  });
  it("rejects missing angle or topic", async () => {
    expect((await POST(req({ ...good, angle: "" }))).status).toBe(400);
    expect((await POST(req({ ...good, topic: undefined }))).status).toBe(400);
  });
  it("rejects bad platforms value", async () => {
    expect((await POST(req({ ...good, platforms: "linkedin" }))).status).toBe(400);
  });
  it("drafts for valid input", async () => {
    const res = await POST(req(good));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toHaveLength(1);
    expect(json.results[0].body).toBe("Draft text");
    expect(draftDaily).toHaveBeenCalledOnce();
  });
  it("hides error details on failure", async () => {
    vi.mocked(draftDaily).mockRejectedValueOnce(new Error("boom at C:\\secret\\path"));
    const res = await POST(req(good));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
