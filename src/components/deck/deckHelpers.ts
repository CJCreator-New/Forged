// Pure helpers for the deck editor. No network, no file system, so they can run in the browser and in tests.
import { THEME_COLORS } from "../../lib/pipeline/deck/themes";
import type { LogoCorner, LogoSize } from "../../lib/assets/logo";
import type { LogoSettings } from "../../lib/pipeline/deck/extras";
import type { Deck } from "../../lib/schemas/deck";

export type DeckTheme = Deck["theme"];
export type Colours = Deck["colors"];
export type ColourKey = keyof Colours;
export type Corner = Deck["styling"]["corner"];
export type Card = Deck["styling"]["card"];
export type Padding = Deck["styling"]["padding"];

export const COLOUR_KEYS: ColourKey[] = ["bg", "text", "accent", "muted"];

export const COLOUR_LABELS: Record<ColourKey, string> = {
  bg: "Background",
  text: "Text",
  accent: "Accent",
  muted: "Muted",
};

export const THEME_OPTIONS: { value: DeckTheme; label: string }[] = [
  { value: "clean-light", label: "Clean light" },
  { value: "dark-tech", label: "Dark tech" },
  { value: "warm-paper", label: "Warm paper" },
];

export const CORNER_OPTIONS: { value: Corner; label: string; px: number }[] = [
  { value: "square", label: "Square", px: 0 },
  { value: "rounded", label: "Rounded", px: 12 },
  { value: "very-rounded", label: "Very rounded", px: 24 },
];

export const CARD_OPTIONS: { value: Card; label: string }[] = [
  { value: "flat", label: "Flat" },
  { value: "outlined", label: "Outlined" },
  { value: "shadow", label: "Shadow" },
];

export const PADDING_OPTIONS: { value: Padding; label: string; px: number }[] = [
  { value: "small", label: "Small", px: 48 },
  { value: "medium", label: "Medium", px: 72 },
  { value: "large", label: "Large", px: 96 },
];

export const LOGO_CORNER_OPTIONS: { value: LogoCorner; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
];

// Share of slide width, matching doc 03 section 9.
export const LOGO_SIZE_OPTIONS: { value: LogoSize; label: string; fraction: number }[] = [
  { value: "small", label: "Small", fraction: 0.1 },
  { value: "medium", label: "Medium", fraction: 0.15 },
  { value: "large", label: "Large", fraction: 0.2 },
];

export const LOGO_OPACITY_MIN = 60;
export const LOGO_OPACITY_MAX = 100;
export const LOGO_MARGIN_PX = 60;
export const SLIDE_WIDTH_PX = 1080;
export const SLIDE_HEIGHT_PX = 1350;

export function isHexColour(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function sameColour(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

// Colours the user changed away from the current theme's preset.
export function changedColourKeys(current: Colours, theme: DeckTheme): ColourKey[] {
  const preset = THEME_COLORS[theme];
  return COLOUR_KEYS.filter((key) => !sameColour(current[key], preset[key]));
}

// Colours for a new theme. A colour the user changed is kept when keepChanged is true; every other colour takes the new preset.
export function applyThemePreset(
  current: Colours,
  fromTheme: DeckTheme,
  toTheme: DeckTheme,
  keepChanged: boolean,
): Colours {
  const kept = new Set(keepChanged ? changedColourKeys(current, fromTheme) : []);
  const preset = THEME_COLORS[toTheme];
  const next = { ...preset };
  for (const key of COLOUR_KEYS) {
    if (kept.has(key)) next[key] = current[key];
  }
  return next;
}

export function cornerRadiusPx(corner: Corner): number {
  return CORNER_OPTIONS.find((o) => o.value === corner)?.px ?? 12;
}

export function paddingPx(padding: Padding): number {
  return PADDING_OPTIONS.find((o) => o.value === padding)?.px ?? 72;
}

// Which edges a logo corner sits on, used to place the preview logo.
export function logoCornerEdges(corner: LogoCorner): { horizontal: "left" | "right"; vertical: "top" | "bottom" } {
  return {
    horizontal: corner.endsWith("left") ? "left" : "right",
    vertical: corner.startsWith("top") ? "top" : "bottom",
  };
}

export function logoSizeFraction(size: LogoSize): number {
  return LOGO_SIZE_OPTIONS.find((o) => o.value === size)?.fraction ?? 0.1;
}

// The slider works in whole percentages. The file stores 0.6 to 1.
export function opacityFromPercent(percent: number): number {
  const clamped = Math.min(LOGO_OPACITY_MAX, Math.max(LOGO_OPACITY_MIN, Math.round(percent)));
  return Math.round(clamped) / 100;
}

export function percentFromOpacity(opacity: number): number {
  const percent = Math.round(opacity * 100);
  return Math.min(LOGO_OPACITY_MAX, Math.max(LOGO_OPACITY_MIN, percent));
}

// Accepts the deck either wrapped as { deck, icons, logo } or flat, the way the file stores it.
export function parseDeckResponse(
  raw: unknown,
): { deck: Deck; icons: boolean; logo: LogoSettings } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const body = raw as Record<string, unknown>;
  const source = (typeof body.deck === "object" && body.deck !== null ? body.deck : body) as Record<string, unknown>;
  if (!Array.isArray(source.slides) || typeof source.colors !== "object" || source.colors === null) return null;
  const logo = (body.logo ?? source.logo) as LogoSettings | undefined;
  if (!logo) return null;
  return {
    deck: source as unknown as Deck,
    icons: body.icons === true || source.icons === true,
    logo,
  };
}

// Plain English for each error code the deck routes return. Never shows raw server text.
export function errorMessage(code: string | undefined): string {
  switch (code) {
    case "feature_off":
      return "Carousel rendering is off. Turn it on in settings first.";
    case "not_carousel":
      return "This post is not a carousel, so there are no images to make.";
    case "no_deck_for_channel":
      return "There is no deck for this channel. Facebook has no carousel deck.";
    case "render_failed":
      return "The images could not be made. Try again.";
    case "logo_exists":
      return "A logo is already saved. Replace it?";
    case "invalid_deck":
      return "That change does not fit the deck rules, so nothing was saved.";
    case "deck_not_found":
      return "No deck file exists at that path.";
    case "deck_invalid":
      return "This deck file cannot be read. It may be damaged.";
    case "bad_path":
      return "That deck path is not valid.";
    default:
      return "Something went wrong. Try again.";
  }
}

// The changes waiting to be saved. Several quick changes merge into one PATCH body.
export type DeckPatch = {
  theme?: DeckTheme;
  colors?: Partial<Colours>;
  styling?: Partial<Deck["styling"]>;
  icons?: boolean;
  logo?: Partial<LogoSettings>;
};

export function mergeDeckPatch(base: DeckPatch, next: DeckPatch): DeckPatch {
  return {
    ...base,
    ...next,
    colors: base.colors || next.colors ? { ...base.colors, ...next.colors } : undefined,
    styling: base.styling || next.styling ? { ...base.styling, ...next.styling } : undefined,
    logo: base.logo || next.logo ? { ...base.logo, ...next.logo } : undefined,
  };
}

export function hasDeckPatch(patch: DeckPatch): boolean {
  return Object.values(patch).some((v) => v !== undefined);
}

export function fileNameOf(contentPath: string): string {
  const parts = contentPath.split("/");
  return parts[parts.length - 1] ?? contentPath;
}
