import { describe, expect, it } from "vitest";
import { plainError, readApiError, sanitizeText, usableMessage } from "./messages";

describe("plainError", () => {
  it("names the missing key but never shows a value", () => {
    const result = plainError({ code: "missing_key", message: "", key: "OPENROUTER_API_KEY" });
    expect(result.detail).toContain("OPENROUTER_API_KEY");
    expect(result.detail).not.toMatch(/sk-|Bearer/);
  });

  it("falls back to a generic key name when none is given", () => {
    const result = plainError({ code: "missing_key", message: "" });
    expect(result.detail).toContain("a model key");
  });

  it("tells the user where to create the voice file", () => {
    expect(plainError({ code: "voice_missing", message: "" }).detail).toContain("content/voice.md");
  });

  it("offers to turn trend search off when it fails and shows the reason", () => {
    const result = plainError({ code: "trend_failed", message: "The search service timed out" });
    expect(result.action).toBe("turn_trend_off");
    expect(result.detail).toContain("The search service timed out");
    expect(result.detail).toContain("Search for recent news");
  });

  it("explains the monthly cap and offers to turn trend search off", () => {
    for (const code of ["trend_cap_reached", "trend_cap"]) {
      const result = plainError({ code, message: "" });
      expect(result.title).toBe("Monthly news search limit reached");
      expect(result.action).toBe("turn_trend_off");
    }
  });

  it("lists hard failures from the server message", () => {
    const result = plainError({ code: "hard_lint_failed", message: "Emoji found" });
    expect(result.title).toBe("Fix these before you export");
    expect(result.detail).toBe("Emoji found");
  });

  it("asks for a review tick on review_required", () => {
    expect(plainError({ code: "review_required", message: "" }).detail).toContain("review box");
  });

  it("warns about user edits before anything is replaced", () => {
    expect(plainError({ code: "user_edited", message: "" }).title).toBe("You have edited this post");
  });

  it("shows missing facts on facts_changed", () => {
    const result = plainError({ code: "facts_changed", message: "a 40 percent figure" });
    expect(result.detail).toContain("a 40 percent figure");
  });

  it("drops raw JSON messages in the default case", () => {
    const result = plainError({ code: "boom", message: '{"error":{"code":"boom"}}' });
    expect(result.title).toBe("Something went wrong");
    expect(result.detail).not.toContain("{");
  });

  it("never returns an em dash or en dash", () => {
    const result = plainError({ code: "hard_lint_failed", message: "Em dash \u2014 found \u2013 twice" });
    expect(result.detail).not.toMatch(/[\u2014\u2013]/);
  });
});

describe("sanitizeText", () => {
  it("replaces em and en dashes with a comma", () => {
    expect(sanitizeText("one \u2014 two \u2013 three")).toBe("one, two, three");
  });
});

describe("usableMessage", () => {
  it("returns an empty string for JSON-like or missing text", () => {
    expect(usableMessage(undefined)).toBe("");
    expect(usableMessage("   ")).toBe("");
    expect(usableMessage('{"a":1}')).toBe("");
  });
});

describe("readApiError", () => {
  it("reads the standard error shape", () => {
    expect(readApiError({ error: { code: "missing_key", message: "m", key: "K" } }, 400)).toEqual({
      code: "missing_key",
      message: "m",
      key: "K",
    });
  });

  it("falls back to an http code for unknown bodies", () => {
    expect(readApiError("<html>", 500)).toEqual({
      code: "http_500",
      message: "The app could not complete that step.",
    });
  });
});
