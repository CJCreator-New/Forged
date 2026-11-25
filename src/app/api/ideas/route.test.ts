import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/pipeline", () => ({
  generateAngles: vi.fn(async () => ({ path: "ideas/x.md", angles: [], draftable: [{ title: "A" }] })),
  draftDaily: vi.fn(),
}));

import { generateAngles } from "../../../lib/pipeline";
import { POST } from "./route";

const req = (body: unknown, headers: Record<string, string> = { host: "127.0.0.1:3000" }) =>
  new Request("http://127.0.0.1:3000/api/ideas", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => vi.mocked(generateAngles).mockClear());

describe("POST /api/ideas", () => {
  it("rejects non-local requests", async () => {
    const res = await POST(req({ topic: "x" }, { host: "evil.com" }));
    expect(res.status).toBe(403);
    expect(generateAngles).not.toHaveBeenCalled();
  });
  it("rejects empty topic", async () => {
    expect((await POST(req({ topic: "   " }))).status).toBe(400);
  });
  it("rejects topic over 300 chars", async () => {
    expect((await POST(req({ topic: "a".repeat(301) }))).status).toBe(400);
  });
  it("rejects bad JSON", async () => {
    expect((await POST(req("not json"))).status).toBe(400);
  });
  it("returns draftable angles for a good topic", async () => {
    const res = await POST(req({ topic: "hiring in India" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.angles).toEqual([{ title: "A" }]);
    expect(json.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("hides error details on failure", async () => {
    vi.mocked(generateAngles).mockRejectedValueOnce(new Error("secret-ish stack detail"));
    const res = await POST(req({ topic: "x" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret-ish");
  });
});
