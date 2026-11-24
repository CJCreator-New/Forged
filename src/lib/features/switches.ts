// Pairs each switch with its default and its current value, for the settings page.
import { FEATURE_DEFAULTS } from "./defaults";
import * as flags from "./flags";

export type SwitchRow = { key: string; defaultValue: unknown; currentValue: unknown };

export function listSwitches(): SwitchRow[] {
  const current: Record<keyof typeof FEATURE_DEFAULTS, unknown> = {
    trend_mode: flags.trendMode(),
    humanise: flags.humanise(),
    carousel_render: flags.carouselRender(),
    icons: flags.icons(),
    theme: flags.theme(),
    styling: flags.styling(),
    logo: flags.logo(),
    variants: flags.variants(),
    length: flags.length(),
    performance_loop: flags.performanceLoop(),
    linter_soft_warnings: flags.linterSoftWarnings(),
  };
  return (Object.keys(FEATURE_DEFAULTS) as (keyof typeof FEATURE_DEFAULTS)[]).map((key) => ({
    key,
    defaultValue: FEATURE_DEFAULTS[key],
    currentValue: current[key],
  }));
}
