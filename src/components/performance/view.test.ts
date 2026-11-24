import { describe, expect, it } from "vitest";
import {
  buildLogRow,
  buildNumbers,
  emptyLogForm,
  localDateString,
  progressPercent,
  sentenceCase,
  thresholdLine,
  thresholdSentence,
  typicalEditLevel,
} from "./view";

describe("typical edit level", () => {
  it("turns the average score back into plain words", () => {
    expect(typicalEditLevel(2.9)).toBe("As-is");
    expect(typicalEditLevel(2)).toBe("Light edits");
    expect(typicalEditLevel(1.2)).toBe("Rewrite");
    expect(typicalEditLevel(0)).toBe("Not rated");
  });
});

describe("threshold copy", () => {
  it("uses the singular for one post", () => {
    expect(thresholdSentence(1)).toBe("1 more post needed");
  });

  it("uses the plural otherwise", () => {
    expect(thresholdSentence(13)).toBe("13 more posts needed");
  });

  it("reads 1 more post needed for 19 logged posts against 20", () => {
    expect(thresholdLine(19, 20, 1)).toBe("Logged 19 of 20 posts. 1 more post needed before the ranking turns on.");
  });

  it("caps the progress bar at 100 percent", () => {
    expect(progressPercent(25, 20)).toBe(100);
    expect(progressPercent(7, 20)).toBe(35);
  });

  it("capitalises the first letter of a ranking reason", () => {
    expect(sentenceCase("your last 4 carousel posts on AI averaged 1,200 reach")).toBe(
      "Your last 4 carousel posts on AI averaged 1,200 reach",
    );
  });
});

describe("form to row", () => {
  const base = { ...emptyLogForm(new Date(2026, 10, 24)), postId: "p-010", topic: "AI tools" };

  it("defaults the date to today in local time", () => {
    expect(emptyLogForm(new Date(2026, 10, 24, 23, 30)).date).toBe("2026-11-24");
    expect(localDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("builds a row with blank optional numbers as null", () => {
    const result = buildLogRow(base);
    expect("row" in result && result.row.reach).toBe(null);
    expect("row" in result && result.row.edit_rating).toBe(null);
  });

  it("asks for a post ID and a topic", () => {
    expect(buildLogRow({ ...base, postId: " " })).toEqual({ error: "Add a post ID." });
    expect(buildLogRow({ ...base, topic: "" })).toEqual({ error: "Add the topic." });
  });

  it("refuses a reach that is not a whole number", () => {
    expect(buildLogRow({ ...base, reach: "12.5" })).toEqual({ error: "Reach must be a whole number, 0 or more." });
  });

  it("refuses a variant below 1", () => {
    expect(buildLogRow({ ...base, variant: "0" })).toEqual({ error: "Variant must be a whole number, 1 or more." });
  });

  it("checks the numbers for an edit", () => {
    expect(buildNumbers("1200", "-3")).toEqual({ error: "Followers must be a whole number, 0 or more." });
    expect(buildNumbers("", "45")).toEqual({ reach: null, followers: 45 });
  });
});
