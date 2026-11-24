import { describe, expect, it } from "vitest";
import { POST as createWeek } from "./route";
import { GET as viewWeek } from "./view/route";
import { POST as adaptWeek } from "./adapt/route";

// Only refusal paths are tested here. None of them reach the model or write a file.

const LOCAL = { host: "127.0.0.1:3000", "content-type": "application/json" };

describe("POST /api/week", () => {
  it("refuses a request from another host", async () => {
    const res = await createWeek(
      new Request("http://127.0.0.1:3000/api/week", {
        method: "POST",
        headers: { host: "evil.example.com", "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("refuses a bad week id before anything is created", async () => {
    const res = await createWeek(
      new Request("http://127.0.0.1:3000/api/week", {
        method: "POST",
        headers: LOCAL,
        body: JSON.stringify({ week_id: "2026-48", start_date: "2026-11-23", brief: {} }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("bad_request");
  });
});

describe("GET /api/week/view", () => {
  it("refuses a bad week id", async () => {
    const res = await viewWeek(new Request("http://127.0.0.1:3000/api/week/view?week=nope", { headers: LOCAL }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for a week that does not exist", async () => {
    const res = await viewWeek(new Request("http://127.0.0.1:3000/api/week/view?week=2099-W01", { headers: LOCAL }));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/week/adapt", () => {
  it("refuses a week that has no pillar yet", async () => {
    const res = await adaptWeek(
      new Request("http://127.0.0.1:3000/api/week/adapt", {
        method: "POST",
        headers: LOCAL,
        body: JSON.stringify({ week_path: "weeks/2099-W01" }),
      }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("pillar_missing");
  });

  it("refuses a path that is not a week folder", async () => {
    const res = await adaptWeek(
      new Request("http://127.0.0.1:3000/api/week/adapt", {
        method: "POST",
        headers: LOCAL,
        body: JSON.stringify({ week_path: "../secrets" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
