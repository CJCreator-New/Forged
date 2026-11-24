import type { Deck } from "../../schemas/deck";

export type DeckTheme = Deck["theme"];
export type DeckColors = Deck["colors"];

// Default colour tokens for each built-in theme (doc 03 section 3). Users can override any token per deck.
export const THEME_COLORS: Record<DeckTheme, DeckColors> = {
  "clean-light": { bg: "#ffffff", text: "#111827", accent: "#2563eb", muted: "#6b7280" },
  "dark-tech": { bg: "#0b1220", text: "#f5f7fa", accent: "#4fd1c5", muted: "#8a94a6" },
  "warm-paper": { bg: "#f7f3ea", text: "#2b2118", accent: "#c2410c", muted: "#8a7f70" },
};
