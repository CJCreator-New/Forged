import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONTENT_ROOT, resolveContentPath } from "./paths";

describe("resolveContentPath (path safety)", () => {
  it("accepts a normal path inside content/", () => {
    const p = resolveContentPath("ideas/2026-11-24-ai.md");
    expect(p).toBe(path.join(CONTENT_ROOT, "ideas", "2026-11-24-ai.md"));
  });

  it("rejects ../secret", () => {
    expect(() => resolveContentPath("../secret")).toThrow(/outside content/);
  });

  it("rejects a traversal that climbs out after going in", () => {
    expect(() => resolveContentPath("ideas/../../secret")).toThrow(/outside content/);
  });

  it("rejects an absolute path outside content/", () => {
    expect(() => resolveContentPath(path.resolve("/", "etc", "passwd"))).toThrow(/outside content/);
  });

  it("rejects the content root itself", () => {
    expect(() => resolveContentPath(".")).toThrow(/outside content/);
  });

  it("rejects an empty path", () => {
    expect(() => resolveContentPath("")).toThrow();
  });
});
