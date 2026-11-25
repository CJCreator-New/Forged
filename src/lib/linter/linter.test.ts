import { describe, expect, it } from "vitest";
import { hasEmDash, hasEmoji, lintPost } from "./index";
import {
  CLEAN_POST,
  H1,
  H2,
  H3,
  H4,
  H5,
  H5_INSTAGRAM,
  LENGTH_BAD,
  LENGTH_GOOD,
  type Fixtures,
} from "./fixtures";

type P = "linkedin" | "instagram" | "facebook";

function checkRule(id: string, fx: Fixtures, platform: P = "linkedin") {
  describe(id, () => {
    fx.good.forEach((body, i) =>
      it(`good ${i + 1} passes`, () => {
        const ids = lintPost({ platform, body, softWarnings: false }).hard.map((x) => x.id);
        expect(ids).not.toContain(id);
      }),
    );
    fx.bad.forEach((body, i) =>
      it(`bad ${i + 1} fails`, () => {
        const r = lintPost({ platform, body, softWarnings: false });
        expect(r.hard.map((x) => x.id)).toContain(id);
        expect(r.passed).toBe(false);
      }),
    );
  });
}

describe("helpers", () => {
  it("hasEmoji detects flag, skin tone and ZWJ sequences", () => {
    expect(hasEmoji("\u{1F1EE}\u{1F1F3}")).toBe(true);
    expect(hasEmoji("\u{1F44D}\u{1F3FD}")).toBe(true);
    expect(hasEmoji("\u{1F468}\u200D\u{1F469}\u200D\u{1F467}")).toBe(true);
    expect(hasEmoji("\u{1F3FD}")).toBe(true);
    expect(hasEmoji("good post with a flag-like word")).toBe(false);
    expect(hasEmoji("digits 123 # * ok")).toBe(false);
  });
  it("hasEmDash", () => {
    expect(hasEmDash("a\u2014b")).toBe(true);
    expect(hasEmDash("a-b \u2013 c")).toBe(false);
  });
});

checkRule("H1", H1);
checkRule("H2", H2);
checkRule("H3", H3);
checkRule("H4", H4);
checkRule("H5", H5, "linkedin");
checkRule("H5", H5_INSTAGRAM, "instagram");

describe("H5 facebook has no cap", () => {
  it("passes a very long body", () => {
    const r = lintPost({ platform: "facebook", body: "a".repeat(10000), softWarnings: false });
    expect(r.hard).toEqual([]);
  });
});

describe("H5-length", () => {
  for (const key of Object.keys(LENGTH_GOOD)) {
    const [platform, length] = key.split("-") as [P, "short" | "medium" | "long"];
    it(`${key} good`, () => {
      const r = lintPost({ platform, body: LENGTH_GOOD[key], length, softWarnings: false });
      expect(r.hard.map((x) => x.id)).not.toContain("H5-length");
    });
    it(`${key} bad`, () => {
      const r = lintPost({ platform, body: LENGTH_BAD[key], length, softWarnings: false });
      expect(r.hard.map((x) => x.id)).toContain("H5-length");
    });
  }
  it("is skipped when length not given", () => {
    const r = lintPost({ platform: "linkedin", body: "tiny" });
    expect(r.hard).toEqual([]);
  });
});

describe("soft rules", () => {
  const ids = (r: ReturnType<typeof lintPost>) => r.soft.map((x) => x.id);

  it("clean post has no issues", () => {
    const r = lintPost({ platform: "linkedin", body: CLEAN_POST });
    expect(r.hard).toEqual([]);
    expect(r.passed).toBe(true);
  });
  it("S1 AI-tell words", () => {
    expect(ids(lintPost({ platform: "linkedin", body: "Let us leverage this." }))).toContain("S1");
    expect(ids(lintPost({ platform: "linkedin", body: "Here\u2019s the thing about it." }))).toContain("S1");
    expect(ids(lintPost({ platform: "linkedin", body: "A plain sentence." }))).not.toContain("S1");
  });
  it("S2 hook length", () => {
    const long = "a".repeat(201);
    expect(ids(lintPost({ platform: "linkedin", body: "x", hook: long }))).toContain("S2");
    expect(ids(lintPost({ platform: "linkedin", body: "x", hook: "a".repeat(200) }))).not.toContain("S2");
    expect(ids(lintPost({ platform: "instagram", body: "x", hook: "a".repeat(126) }))).toContain("S2");
    expect(ids(lintPost({ platform: "instagram", body: "x", hook: "a".repeat(125) }))).not.toContain("S2");
  });
  it("S3 more than one question", () => {
    expect(ids(lintPost({ platform: "linkedin", body: "Why? How?" }))).toContain("S3");
    expect(ids(lintPost({ platform: "linkedin", body: "Why?" }))).not.toContain("S3");
  });
  it("S4 hashtags", () => {
    expect(ids(lintPost({ platform: "linkedin", body: "x", hashtags: ["a", "b", "c", "d"] }))).toContain("S4");
    expect(ids(lintPost({ platform: "instagram", body: "x", hashtags: ["a", "b", "c", "d", "e"] }))).not.toContain("S4");
    expect(ids(lintPost({ platform: "facebook", body: "x", hashtags: ["a", "b", "c"] }))).toContain("S4");
  });
  it("S6 number without source", () => {
    expect(ids(lintPost({ platform: "linkedin", body: "Sales rose 40%." }))).toContain("S6");
    expect(ids(lintPost({ platform: "linkedin", body: "Sales rose 40%. Source: annual report" }))).not.toContain("S6");
    expect(ids(lintPost({ platform: "linkedin", body: "Sales rose 40%. https://example.org" }))).not.toContain("S6");
  });
  it("softWarnings false suppresses soft issues", () => {
    const r = lintPost({ platform: "linkedin", body: "Leverage 40%? Why?", softWarnings: false });
    expect(r.soft).toEqual([]);
  });
  it("soft issues never block", () => {
    const r = lintPost({ platform: "linkedin", body: "Leverage 40%? Why?" });
    expect(r.soft.length).toBeGreaterThan(0);
    expect(r.passed).toBe(true);
  });
});
