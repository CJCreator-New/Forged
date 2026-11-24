import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURE_DEFAULTS } from "../../lib/features/defaults";
import { SWITCH_COPY, describeDefault, parseWholeNumber, type SwitchKey } from "./options";
import { NAV_ITEMS, isActivePath } from "../shell/nav";

const UI_FILES = [
  "options.ts",
  "SettingsScreen.tsx",
  "../shell/AppShell.tsx",
  "../shell/nav.ts",
  "../../app/layout.tsx",
  "../../app/page.tsx",
  "../../app/settings/page.tsx",
  "../../app/not-found.tsx",
];

describe("switch copy", () => {
  it("has a plain label and help text for every switch", () => {
    for (const key of Object.keys(FEATURE_DEFAULTS) as SwitchKey[]) {
      expect(SWITCH_COPY[key].label.length).toBeGreaterThan(0);
      expect(SWITCH_COPY[key].help.length).toBeGreaterThan(0);
    }
  });

  it("describes each default in words", () => {
    for (const key of Object.keys(FEATURE_DEFAULTS) as SwitchKey[]) {
      expect(describeDefault(key, FEATURE_DEFAULTS[key]).length).toBeGreaterThan(0);
    }
    expect(describeDefault("trend_mode", false)).toBe("Off");
    expect(describeDefault("humanise", true)).toBe("On");
    expect(describeDefault("theme", "clean-light")).toBe("Clean light");
  });
});

describe("parseWholeNumber", () => {
  it("accepts whole numbers in range", () => {
    expect(parseWholeNumber("2", 2, 3)).toBe(2);
    expect(parseWholeNumber(" 3 ", 2, 3)).toBe(3);
  });

  it("rejects out of range, decimals and text", () => {
    expect(parseWholeNumber("1", 2, 3)).toBeNull();
    expect(parseWholeNumber("4", 2, 3)).toBeNull();
    expect(parseWholeNumber("2.5", 2, 3)).toBeNull();
    expect(parseWholeNumber("two", 2, 3)).toBeNull();
    expect(parseWholeNumber("", 2, 3)).toBeNull();
  });
});

describe("navigation", () => {
  it("has Daily, Week, Performance and Settings in that order", () => {
    expect(NAV_ITEMS.map((n) => n.label)).toEqual(["Daily", "Week", "Performance", "Settings"]);
  });

  it("marks a page active on itself and its children only", () => {
    expect(isActivePath("/settings", "/settings")).toBe(true);
    expect(isActivePath("/settings/x", "/settings")).toBe(true);
    expect(isActivePath("/settingsx", "/settings")).toBe(false);
  });
});

describe("UI copy", () => {
  // The brief bans em dashes, en dashes and emojis in any text. This checks the UI files.
  it("contains no em dash, en dash or emoji", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const rel of UI_FILES) {
      const text = readFileSync(path.join(__dirname, rel), "utf8");
      expect(text, rel).not.toMatch(/[–—]/);
      expect(text, rel).not.toMatch(emoji);
    }
  });
});
