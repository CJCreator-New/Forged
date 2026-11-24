import features from "../../../config/features.json";
import { describe, expect, it } from "vitest";
import { FEATURE_DEFAULTS } from "./defaults";
import * as flags from "./flags";
import { listSwitches } from "./switches";

describe("feature switches (defaults load)", () => {
  it("config/features.json matches the documented defaults", () => {
    expect(features).toEqual(FEATURE_DEFAULTS);
  });

  it("each switch function returns its default", () => {
    expect(flags.trendMode()).toBe(false);
    expect(flags.humanise()).toBe(true);
    expect(flags.carouselRender()).toBe(false);
    expect(flags.icons()).toBe(false);
    expect(flags.theme()).toBe("clean-light");
    expect(flags.styling()).toEqual({ corner: "rounded", card: "flat", padding: "medium" });
    expect(flags.logo().enabled).toBe(false);
    expect(flags.variants()).toBe(2);
    expect(flags.length()).toBe("medium");
    expect(flags.performanceLoop()).toEqual({ enabled: true, min_posts: 20, min_group: 3 });
    expect(flags.linterSoftWarnings()).toBe(true);
  });

  it("the settings list shows a default and a current value for every switch", () => {
    const rows = listSwitches();
    expect(rows).toHaveLength(Object.keys(FEATURE_DEFAULTS).length);
    for (const row of rows) {
      expect(row.currentValue).toEqual(row.defaultValue);
    }
  });
});
