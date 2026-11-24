import { describe, expect, it } from "vitest";
import { requireLocal } from "./guard";

const base = "http://127.0.0.1:3000/api/settings";

function req(headers: Record<string, string>): Request {
  return new Request(base, { headers });
}

describe("requireLocal (ADR 0008)", () => {
  it("allows the local host with no origin", () => {
    expect(requireLocal(req({ host: "127.0.0.1:3000" }))).toBeNull();
  });

  it("allows localhost with a local origin", () => {
    expect(requireLocal(req({ host: "localhost:3000", origin: "http://localhost:3000" }))).toBeNull();
  });

  it("rejects a DNS-rebinding host", () => {
    const res = requireLocal(req({ host: "evil.example.com:3000" }));
    expect(res?.status).toBe(403);
  });

  it("rejects a cross-site origin even with a local host", () => {
    const res = requireLocal(req({ host: "127.0.0.1:3000", origin: "https://evil.example.com" }));
    expect(res?.status).toBe(403);
  });

  it("rejects a forwarded request", () => {
    const res = requireLocal(req({ host: "127.0.0.1:3000", "x-forwarded-for": "10.0.0.5" }));
    expect(res?.status).toBe(403);
  });

  it("rejects a missing host", () => {
    expect(requireLocal(new Request(base, { headers: {} }))?.status).toBe(403);
  });
});
