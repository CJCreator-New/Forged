import { describe, expect, it } from "vitest";
import { GET, POST, PUT } from "./route";

// Only refusal paths are tested here. None of them reach the model or write a file.

const LOCAL = { host: "127.0.0.1:3000", "content-type": "application/json" };

describe("POST /api/pillar", () => {
  it("refuses a week path that climbs out of weeks/", async () => {
    const res = await POST(
      new Request("http://127.0.0.1:3000/api/pillar", {
        method: "POST",
        headers: LOCAL,
        body: JSON.stringify({ week_path: "../weeks/2026-W48" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("refuses a request from another host", async () => {
    const res = await POST(
      new Request("http://127.0.0.1:3000/api/pillar", {
        method: "POST",
        headers: { host: "evil.example.com", "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /api/pillar", () => {
  it("returns 404 pillar_not_found when the week has no pillar", async () => {
    const res = await GET(new Request("http://127.0.0.1:3000/api/pillar?week=2099-W03", { headers: LOCAL }));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("pillar_not_found");
  });

  it("refuses a bad week id with 400", async () => {
    const res = await GET(new Request("http://127.0.0.1:3000/api/pillar?week=nope", { headers: LOCAL }));
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/pillar", () => {
  it("returns 404 when the week has no pillar yet", async () => {
    const res = await PUT(
      new Request("http://127.0.0.1:3000/api/pillar", {
        method: "PUT",
        headers: LOCAL,
        body: JSON.stringify({ week_path: "weeks/2099-W01", body: "Some text" }),
      }),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });
});
