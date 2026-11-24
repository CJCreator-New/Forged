import { describe, expect, it } from "vitest";
import { lintText } from "./index";
import { FIXTURES } from "./fixtures";

const LI = { channel: "linkedin" as const, topic: "AI operations" };

describe("linter fixtures", () => {
  it.each(FIXTURES.map((f, i) => [i, f] as const))(
    "fixture %i: %s rule gives expected %s",
    (_i, fixture) => {
      const result = lintText(fixture.text, fixture.ctx);
      const prefix = `${fixture.id}:`;
      const hardHits = result.hard.filter((m) => m.startsWith(prefix));
      const softHits = result.soft.filter((m) => m.startsWith(prefix));

      if (fixture.expect === "hard") {
        expect(hardHits.length).toBeGreaterThan(0);
      } else if (fixture.expect === "soft") {
        expect(softHits.length).toBeGreaterThan(0);
      } else {
        expect(hardHits).toEqual([]);
        expect(softHits).toEqual([]);
      }
    },
  );
});

describe("linter extra checks", () => {
  it("S7 flags a double hyphen as soft, not hard", () => {
    const result = lintText("Two steps -- then the checklist.", LI);
    expect(result.soft.some((m) => m.startsWith("S7:"))).toBe(true);
    expect(result.hard).toEqual([]);
  });

  it("S3 warns when a question CTA has more than one question in the closing sentences", () => {
    const text = "Body text here. Would you try it? Which step is hardest?";
    const result = lintText(text, { ...LI, hasQuestionCta: true });
    expect(result.soft.some((m) => m.startsWith("S3:"))).toBe(true);
  });

  it("S6 warns when a stat has no source", () => {
    const result = lintText("Handover time fell by half.", { ...LI, hasStatWithoutSource: true });
    expect(result.soft.some((m) => m.startsWith("S6:"))).toBe(true);
  });

  it("adds the review tick note when review is required", () => {
    const result = lintText("A plain post.", { ...LI, reviewRequired: true });
    expect(result.soft).toContain("Review tick needed before export");
  });

  it("reports the position of an en dash in the message", () => {
    const text = "Shift handovers went from 40 minutes \u2013 to 10.";
    const result = lintText(text, LI);
    expect(result.hard).toContain(`H2: en dash found at position ${text.indexOf("\u2013")}`);
  });
});
