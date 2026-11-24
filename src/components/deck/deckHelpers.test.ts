import { describe, expect, it } from "vitest";
import { THEME_COLORS } from "../../lib/pipeline/deck/themes";
import {
  applyThemePreset,
  changedColourKeys,
  cornerRadiusPx,
  errorMessage,
  fileNameOf,
  hasDeckPatch,
  isHexColour,
  logoCornerEdges,
  mergeDeckPatch,
  logoSizeFraction,
  opacityFromPercent,
  paddingPx,
  parseDeckResponse,
  percentFromOpacity,
} from "./deckHelpers";

describe("applyThemePreset", () => {
  it("takes the new theme colours when the user changed nothing", () => {
    const current = { ...THEME_COLORS["clean-light"] };
    expect(applyThemePreset(current, "clean-light", "dark-tech", true)).toEqual(THEME_COLORS["dark-tech"]);
  });

  it("keeps only the colours the user changed when keep is on", () => {
    const current = { ...THEME_COLORS["clean-light"], accent: "#ff0066" };
    const next = applyThemePreset(current, "clean-light", "warm-paper", true);
    expect(next.accent).toBe("#ff0066");
    expect(next.bg).toBe(THEME_COLORS["warm-paper"].bg);
    expect(next.text).toBe(THEME_COLORS["warm-paper"].text);
    expect(next.muted).toBe(THEME_COLORS["warm-paper"].muted);
  });

  it("overwrites every colour when keep is off", () => {
    const current = { ...THEME_COLORS["clean-light"], accent: "#ff0066" };
    expect(applyThemePreset(current, "clean-light", "warm-paper", false)).toEqual(THEME_COLORS["warm-paper"]);
  });

  it("does not count a preset colour written in another letter case as a change", () => {
    const current = { ...THEME_COLORS["clean-light"], bg: "#FFFFFF" };
    expect(changedColourKeys(current, "clean-light")).toEqual([]);
    const next = applyThemePreset(current, "clean-light", "dark-tech", true);
    expect(next.bg).toBe(THEME_COLORS["dark-tech"].bg);
  });
});

describe("option mapping", () => {
  it("maps corners to pixel radius", () => {
    expect(cornerRadiusPx("square")).toBe(0);
    expect(cornerRadiusPx("rounded")).toBe(12);
    expect(cornerRadiusPx("very-rounded")).toBe(24);
  });

  it("maps padding to pixels", () => {
    expect(paddingPx("small")).toBe(48);
    expect(paddingPx("medium")).toBe(72);
    expect(paddingPx("large")).toBe(96);
  });

  it("maps each logo corner to its two edges", () => {
    expect(logoCornerEdges("top-left")).toEqual({ horizontal: "left", vertical: "top" });
    expect(logoCornerEdges("top-right")).toEqual({ horizontal: "right", vertical: "top" });
    expect(logoCornerEdges("bottom-left")).toEqual({ horizontal: "left", vertical: "bottom" });
    expect(logoCornerEdges("bottom-right")).toEqual({ horizontal: "right", vertical: "bottom" });
  });

  it("maps logo sizes to shares of slide width", () => {
    expect(logoSizeFraction("small")).toBe(0.1);
    expect(logoSizeFraction("medium")).toBe(0.15);
    expect(logoSizeFraction("large")).toBe(0.2);
  });

  it("converts opacity between percent and 0.6 to 1, clamped", () => {
    expect(opacityFromPercent(60)).toBe(0.6);
    expect(opacityFromPercent(100)).toBe(1);
    expect(opacityFromPercent(20)).toBe(0.6);
    expect(opacityFromPercent(150)).toBe(1);
    expect(percentFromOpacity(0.8)).toBe(80);
  });
});

describe("validation and parsing", () => {
  it("accepts six-digit hex only", () => {
    expect(isHexColour("#1d5c58")).toBe(true);
    expect(isHexColour("#abc")).toBe(false);
    expect(isHexColour("red")).toBe(false);
  });

  it("reads a deck from either the wrapped or the flat shape", () => {
    const deck = {
      deck_id: "x",
      channel: "linkedin",
      size: { w: 1080, h: 1350 },
      theme: "clean-light",
      colors: THEME_COLORS["clean-light"],
      styling: { corner: "rounded", card: "flat", padding: "medium" },
      slides: [],
    };
    const logo = { enabled: false, corner: "top-right", size: "small", opacity: 1, all_slides: false };
    expect(parseDeckResponse({ deck, icons: true, logo })?.icons).toBe(true);
    expect(parseDeckResponse({ ...deck, icons: false, logo })?.deck.deck_id).toBe("x");
    expect(parseDeckResponse({ error: { code: "x" } })).toBeNull();
  });

  it("returns only the file name from a content path", () => {
    expect(fileNameOf("weeks/2026-W47/days/2026-11-24/renders/linkedin/slide-1.png")).toBe("slide-1.png");
  });
});

describe("errorMessage", () => {
  const codes = [
    "feature_off",
    "not_carousel",
    "no_deck_for_channel",
    "render_failed",
    "logo_exists",
    "invalid_deck",
  ];

  it.each(codes)("gives a plain sentence for %s", (code) => {
    const text = errorMessage(code);
    expect(text.length).toBeGreaterThan(10);
    expect(text).not.toMatch(/[{}"]/);
  });

  it("gives the exact feature-off wording", () => {
    expect(errorMessage("feature_off")).toBe("Carousel rendering is off. Turn it on in settings first.");
  });

  it("falls back to a generic sentence for unknown codes", () => {
    expect(errorMessage("weird_code")).toBe("Something went wrong. Try again.");
    expect(errorMessage(undefined)).toBe("Something went wrong. Try again.");
  });

  it("uses no em dashes or en dashes in any message", () => {
    for (const code of [...codes, "deck_not_found", "deck_invalid", "bad_path", "x"]) {
      expect(errorMessage(code)).not.toMatch(/[–—]/);
    }
  });
});

describe("mergeDeckPatch", () => {
  it("merges colour and logo fields from several quick changes into one body", () => {
    const first = mergeDeckPatch({}, { colors: { accent: "#111111" }, logo: { opacity: 0.8 } });
    const second = mergeDeckPatch(first, { colors: { bg: "#222222" }, logo: { corner: "bottom-left" } });
    expect(second.colors).toEqual({ accent: "#111111", bg: "#222222" });
    expect(second.logo).toEqual({ opacity: 0.8, corner: "bottom-left" });
  });

  it("keeps the latest theme and icons value", () => {
    const merged = mergeDeckPatch({ theme: "clean-light", icons: false }, { theme: "dark-tech", icons: true });
    expect(merged.theme).toBe("dark-tech");
    expect(merged.icons).toBe(true);
  });

  it("reports whether a patch has anything to send", () => {
    expect(hasDeckPatch({})).toBe(false);
    expect(hasDeckPatch(mergeDeckPatch({}, { icons: false }))).toBe(true);
  });
});
