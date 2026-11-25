import { describe, expect, it } from "vitest";
import { isLocalRequest } from "./local-guard";

const h = (o: Record<string, string>) => new Headers(o);

describe("isLocalRequest", () => {
  it("accepts 127.0.0.1", () => expect(isLocalRequest(h({ host: "127.0.0.1" }))).toBe(true));
  it("accepts 127.0.0.1 with port", () => expect(isLocalRequest(h({ host: "127.0.0.1:3000" }))).toBe(true));
  it("accepts localhost:3000", () => expect(isLocalRequest(h({ host: "localhost:3000" }))).toBe(true));
  it("rejects other hosts", () => expect(isLocalRequest(h({ host: "evil.com" }))).toBe(false));
  it("rejects look-alike hosts", () => expect(isLocalRequest(h({ host: "localhost.evil.com" }))).toBe(false));
  it("rejects missing host", () => expect(isLocalRequest(h({}))).toBe(false));
  it("rejects a remote x-forwarded-for", () =>
    expect(isLocalRequest(h({ host: "127.0.0.1:3000", "x-forwarded-for": "1.2.3.4" }))).toBe(false));
  it("rejects a list that includes a remote address", () =>
    expect(isLocalRequest(h({ host: "127.0.0.1:3000", "x-forwarded-for": "1.2.3.4, 127.0.0.1" }))).toBe(false));
  it("rejects a remote x-real-ip", () =>
    expect(isLocalRequest(h({ host: "localhost", "x-real-ip": "10.0.0.5" }))).toBe(false));
  it("accepts the loopback address Next sets for local callers", () =>
    expect(isLocalRequest(h({ host: "127.0.0.1:3000", "x-forwarded-for": "::ffff:127.0.0.1" }))).toBe(true));
  it("accepts IPv6 loopback", () =>
    expect(isLocalRequest(h({ host: "localhost:3000", "x-forwarded-for": "::1" }))).toBe(true));
});
