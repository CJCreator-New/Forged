// Pure copy and option lists for the settings screen. No file or network access, so the client can import it.
import { FEATURE_DEFAULTS } from "../../lib/features/defaults";

export type SwitchKey = keyof typeof FEATURE_DEFAULTS;

export type Option = { value: string; label: string };

export const SWITCH_COPY: Record<SwitchKey, { label: string; help: string }> = {
  trend_mode: {
    label: "Trend search",
    help: "Looks up what people are talking about before suggesting ideas. Tries Tavily first, then Firecrawl, each within its monthly limit.",
  },
  humanise: {
    label: "Second pass to sound more human",
    help: "Rewrites each draft once so it reads less like a machine. The first version is kept beside it.",
  },
  carousel_render: {
    label: "Render carousel slides",
    help: "Turns carousel decks into images. When this is off, no browser is started.",
  },
  icons: {
    label: "Icons on slides",
    help: "Adds one simple icon to a slide where it helps the point land.",
  },
  theme: {
    label: "Slide theme",
    help: "The colour scheme for new carousel decks.",
  },
  styling: {
    label: "Slide look",
    help: "Corner shape, card style and spacing on each slide.",
  },
  logo: {
    label: "Logo on slides",
    help: "Shows your logo on the cover and closing slides. Needs a logo file in your assets folder.",
  },
  variants: {
    label: "Variants per post",
    help: "How many alternative hooks to write for each post. Choose 2 or 3.",
  },
  length: {
    label: "Default post length",
    help: "The length new posts start at. You can change it on each post.",
  },
  performance_loop: {
    label: "Learn from past posts",
    help: "Once enough posts have reach numbers, the app shows which kinds of posts did best.",
  },
  linter_soft_warnings: {
    label: "Show soft style warnings",
    help: "Shows gentle suggestions, such as a double hyphen. Hard rule breaks always show.",
  },
};

export const THEME_OPTIONS: Option[] = [
  { value: "clean-light", label: "Clean light" },
  { value: "dark-tech", label: "Dark tech" },
  { value: "warm-paper", label: "Warm paper" },
];

export const LENGTH_OPTIONS: Option[] = [
  { value: "micro", label: "Micro" },
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
  { value: "extended", label: "Extended" },
  { value: "custom", label: "Custom target" },
];

export const CORNER_OPTIONS: Option[] = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "very-rounded", label: "Very rounded" },
];

export const CARD_OPTIONS: Option[] = [
  { value: "flat", label: "Flat" },
  { value: "outlined", label: "Outlined" },
  { value: "shadow", label: "Soft shadow" },
];

export const PADDING_OPTIONS: Option[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

export const LOGO_CORNER_OPTIONS: Option[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
];

export const LOGO_SIZE_OPTIONS: Option[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

export const TASK_LABELS: Record<string, string> = {
  ideas: "Ideas",
  pillar: "Week plan",
  adapt: "Adapting posts",
  slides: "Carousel slides",
  humanise: "Second pass",
  variants: "Variants",
  enhance: "Enhance",
  trend: "Trend search",
};

export const KEY_LABELS: Record<string, string> = {
  OPENROUTER_API_KEY: "OpenRouter key",
  TAVILY_API_KEY: "Tavily search key",
  FIRECRAWL_API_KEY: "Firecrawl search key",
};

export function optionLabel(options: Option[], value: unknown): string {
  return options.find((o) => o.value === String(value))?.label ?? String(value);
}

// Plain-English text for a switch's default value, shown under each control.
export function describeDefault(key: SwitchKey, value: unknown): string {
  const onOff = (v: unknown) => (v === true ? "On" : "Off");
  switch (key) {
    case "theme":
      return optionLabel(THEME_OPTIONS, value);
    case "length":
      return optionLabel(LENGTH_OPTIONS, value);
    case "styling": {
      const s = value as { corner: string; card: string; padding: string };
      return `${optionLabel(CORNER_OPTIONS, s.corner)} corners, ${optionLabel(CARD_OPTIONS, s.card).toLowerCase()} cards, ${optionLabel(PADDING_OPTIONS, s.padding).toLowerCase()} spacing`;
    }
    case "logo": {
      const l = value as { enabled: boolean; corner: string; size: string; opacity: number; all_slides: boolean };
      return `${onOff(l.enabled)}, ${optionLabel(LOGO_CORNER_OPTIONS, l.corner).toLowerCase()}, ${optionLabel(LOGO_SIZE_OPTIONS, l.size).toLowerCase()} size, ${Math.round(l.opacity * 100)}% opacity, ${l.all_slides ? "every slide" : "cover and closing slides"}`;
    }
    case "performance_loop": {
      const p = value as { enabled: boolean; min_posts: number; min_group: number };
      return `${onOff(p.enabled)}, starts after ${p.min_posts} posts, groups of at least ${p.min_group}`;
    }
    case "variants":
      return String(value);
    default:
      return onOff(value);
  }
}

// Parses a whole number typed into a field. Returns null when it is not a whole number in range.
export function parseWholeNumber(text: string, min: number, max: number): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= min && n <= max ? n : null;
}
