// Plain-English labels for the Daily page. Ids match the API and the schemas.
import type { Channel } from "@/lib/schemas/post";

export const CHANNEL_ORDER: Channel[] = ["linkedin", "instagram", "facebook"];

export const CHANNEL_LABEL: Record<Channel, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
};

export const LENGTH_OPTIONS = [
  { value: "micro", label: "Micro" },
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
  { value: "extended", label: "Extended" },
  { value: "custom", label: "Custom" },
] as const;

export type LengthValue = (typeof LENGTH_OPTIONS)[number]["value"];

export const STYLE_OPTIONS = [
  { value: "conversational", label: "Conversational" },
  { value: "analytical", label: "Analytical" },
  { value: "storytelling", label: "Storytelling" },
  { value: "direct", label: "Direct" },
] as const;

// Enhance aims. The ids are the values sent to /api/enhance.
export const ENHANCE_AIMS = [
  { value: "sharper-hook", label: "Sharper opening" },
  { value: "more-concrete", label: "More concrete" },
  { value: "shorter", label: "Shorter" },
  { value: "warmer", label: "Warmer" },
] as const;

export function formatLabel(format: "text" | "carousel"): string {
  return format === "carousel" ? "Carousel" : "Text post";
}

export function statusLabel(lintHardCount: number): string {
  return lintHardCount === 0 ? "Ready to export" : "Needs fixes";
}
