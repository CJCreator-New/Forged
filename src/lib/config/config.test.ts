import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { FEATURE_DEFAULTS } from "../features/defaults";
import { ConfigError } from "./errors";
import { getStyle, loadChannels, loadModels, loadStyles } from "./loaders";
import { SwitchesSchema, readSwitches, writeSwitches } from "./switches";

const FEATURES_PATH = path.join(process.cwd(), "config", "features.json");

// Saved at the start of the switch tests and restored after each one, so config/features.json
// ends up byte-identical to what it was before the tests ran.
let savedFeatures = "";
const startingFeatures = readFileSync(FEATURES_PATH, "utf8");

beforeEach(() => {
  savedFeatures = readFileSync(FEATURES_PATH, "utf8");
});

afterEach(() => {
  writeFileSync(FEATURES_PATH, savedFeatures, "utf8");
});

afterAll(() => {
  expect(readFileSync(FEATURES_PATH, "utf8")).toBe(startingFeatures);
});

describe("config loaders on the real files", () => {
  it("loadModels returns the tasks table", () => {
    const models = loadModels();
    expect(Object.keys(models.tasks)).toContain("ideas");
  });

  it("loadChannels returns all three channels", () => {
    const channels = loadChannels();
    expect(Object.keys(channels).sort()).toEqual(["facebook", "instagram", "linkedin"]);
  });

  it("loadStyles returns styles sorted by id", () => {
    const ids = loadStyles().map((s) => s.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toEqual([...ids].sort());
  });

  it("getStyle('direct') returns the direct style", () => {
    expect(getStyle("direct").id).toBe("direct");
  });

  it("getStyle('nope') throws unknown_style with the id", () => {
    let caught: unknown;
    try {
      getStyle("nope");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ConfigError);
    expect(caught).toMatchObject({ code: "unknown_style", id: "nope" });
  });
});

describe("switches", () => {
  it("SwitchesSchema has exactly the keys of FEATURE_DEFAULTS", () => {
    expect(Object.keys(SwitchesSchema.shape).sort()).toEqual(Object.keys(FEATURE_DEFAULTS).sort());
  });

  it("readSwitches matches FEATURE_DEFAULTS on first run", () => {
    expect(readSwitches()).toEqual(FEATURE_DEFAULTS);
  });

  it("writeSwitches with an unknown key throws and leaves the file unchanged", () => {
    let caught: unknown;
    try {
      writeSwitches({ not_a_switch: true } as never);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ConfigError);
    expect(caught).toMatchObject({ code: "unknown_switch", key: "not_a_switch" });
    expect(readFileSync(FEATURES_PATH, "utf8")).toBe(savedFeatures);
  });

  it("writeSwitches with a valid change updates the file and readSwitches sees it", () => {
    const result = writeSwitches({ variants: 3 });
    expect(result.variants).toBe(3);
    expect(readSwitches().variants).toBe(3);
    expect(readSwitches().humanise).toBe(FEATURE_DEFAULTS.humanise);
  });

  it("writeSwitches merges nested objects without dropping sibling keys", () => {
    writeSwitches({ logo: { enabled: true } });
    const after = readSwitches();
    expect(after.logo.enabled).toBe(true);
    expect(after.logo.corner).toBe(FEATURE_DEFAULTS.logo.corner);
  });

  it("writeSwitches with an invalid value throws and leaves the file unchanged", () => {
    expect(() => writeSwitches({ variants: "many" } as never)).toThrow(ConfigError);
    expect(readFileSync(FEATURES_PATH, "utf8")).toBe(savedFeatures);
  });
});
