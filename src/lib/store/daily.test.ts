import { describe, expect, it } from "vitest";
import {
  assertDate,
  assertPlatform,
  assertSlug,
  ideaPath,
  postPath,
  rawPath,
  slugify,
  variantPath,
} from "./daily";

describe("slugify", () => {
  it("lower-cases and hyphenates", () => {
    expect(slugify("AI in Ops!")).toBe("ai-in-ops");
  });
  it("caps at 40 characters with no trailing hyphen", () => {
    const s = slugify("word ".repeat(30));
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });
  it("never returns empty", () => {
    expect(slugify("")).toBe("topic");
    expect(slugify("!!!")).toBe("topic");
  });
});

describe("validators", () => {
  it("accepts allowed platforms only", () => {
    expect(assertPlatform("linkedin")).toBe("linkedin");
    expect(() => assertPlatform("twitter")).toThrow(/Platform/);
    expect(() => assertPlatform("../linkedin")).toThrow(/Platform/);
  });
  it("accepts real dates only", () => {
    expect(assertDate("2026-11-25")).toBe("2026-11-25");
    expect(() => assertDate("2026-13-01")).toThrow();
    expect(() => assertDate("2026-02-30")).toThrow();
    expect(() => assertDate("../x")).toThrow();
    expect(() => assertDate("2026-1-1")).toThrow();
  });
  it("accepts clean slugs only", () => {
    expect(assertSlug("ai-ops-2")).toBe("ai-ops-2");
    expect(() => assertSlug("../x")).toThrow(/Slug/);
    expect(() => assertSlug("C:/abs")).toThrow(/Slug/);
    expect(() => assertSlug("Upper")).toThrow(/Slug/);
    expect(() => assertSlug("")).toThrow(/Slug/);
    expect(() => assertSlug("a".repeat(61))).toThrow(/Slug/);
  });
});

describe("path builders", () => {
  it("build the agreed layout", () => {
    expect(ideaPath("2026-11-25", "ai")).toBe("ideas/2026-11-25-ai.md");
    expect(postPath("2026-11-25", "linkedin")).toBe("daily/2026-11-25/linkedin.md");
    expect(variantPath("2026-11-25", "facebook", 2)).toBe("daily/2026-11-25/variants/facebook-v2.md");
    expect(rawPath("2026-11-25", "instagram")).toBe("daily/2026-11-25/raw/instagram.md");
  });
  it("reject traversal and absolute input", () => {
    expect(() => postPath("../x", "linkedin")).toThrow();
    expect(() => postPath("2026-11-25", "../x")).toThrow();
    expect(() => ideaPath("2026-11-25", "/etc/passwd")).toThrow();
    expect(() => variantPath("2026-11-25", "linkedin", 0)).toThrow();
  });
});
