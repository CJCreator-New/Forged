import { describe, expect, it } from "vitest";
import { GET } from "./route";

const local = (path: string) =>
  new Request(`http://127.0.0.1:3000/api/post?path=${encodeURIComponent(path)}`, {
    headers: { host: "127.0.0.1:3000" },
  });

describe("GET /api/post", () => {
  it("refuses a path that climbs out of content/", async () => {
    const res = await GET(local("../secret.md"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("bad_path");
  });

  it("refuses a non-markdown path", async () => {
    const res = await GET(local("weeks/2099-W01/days/x/linkedin.json"));
    expect(res.status).toBe(400);
  });

  it("refuses a request from another host", async () => {
    const res = await GET(
      new Request("http://127.0.0.1:3000/api/post?path=x.md", { headers: { host: "evil.example.com" } }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 for a post that does not exist", async () => {
    const res = await GET(local("weeks/2099-W01/days/2099-01-01/linkedin.md"));
    expect(res.status).toBe(404);
  });
});
