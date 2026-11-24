// Default values for every feature switch, from docs/04-architecture-and-prompts.md section 9.
// config/features.json starts out equal to these. The settings page shows both.
export const FEATURE_DEFAULTS = {
  trend_mode: false,
  humanise: true,
  carousel_render: false,
  icons: false,
  theme: "clean-light",
  styling: { corner: "rounded", card: "flat", padding: "medium" },
  logo: { enabled: false, corner: "top-right", size: "small", opacity: 1, all_slides: false },
  variants: 2,
  length: "medium",
  performance_loop: { enabled: true, min_posts: 20, min_group: 3 },
  linter_soft_warnings: true,
} as const;

export type FeatureDefaults = typeof FEATURE_DEFAULTS;
