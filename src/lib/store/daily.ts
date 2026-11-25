// Shared rules and path builders for the daily flow. Everything here is relative to content/.

export const PLATFORMS = ["linkedin", "instagram", "facebook"] as const;
export type Platform = (typeof PLATFORMS)[number];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9-]+$/;
const MAX_SLUG = 60;

export function assertPlatform(value: unknown): Platform {
  if (typeof value !== "string" || !(PLATFORMS as readonly string[]).includes(value)) {
    throw new Error(`Platform must be one of: ${PLATFORMS.join(", ")}.`);
  }
  return value as Platform;
}

export function assertDate(value: unknown): string {
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    throw new Error("Date must be in YYYY-MM-DD format.");
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new Error(`Not a real calendar date: ${value}`);
  }
  return value;
}

export function assertSlug(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_SLUG || !SLUG_RE.test(value)) {
    throw new Error(`Slug must be 1 to ${MAX_SLUG} characters: lower-case letters, digits and hyphens only.`);
  }
  return value;
}

export function assertVariantIndex(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 9) {
    throw new Error("Variant index must be a whole number from 1 to 9.");
  }
  return value;
}

// Lower case, hyphens, max 40 characters, never empty.
export function slugify(topic: string): string {
  const slug = String(topic ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug.length > 0 ? slug : "topic";
}

export function ideaPath(date: string, slug: string): string {
  return `ideas/${assertDate(date)}-${assertSlug(slug)}.md`;
}

export function dailyDir(date: string): string {
  return `daily/${assertDate(date)}`;
}

export function postPath(date: string, platform: string): string {
  return `${dailyDir(date)}/${assertPlatform(platform)}.md`;
}

export function variantPath(date: string, platform: string, index: number): string {
  return `${dailyDir(date)}/variants/${assertPlatform(platform)}-v${assertVariantIndex(index)}.md`;
}

export function rawPath(date: string, platform: string): string {
  return `${dailyDir(date)}/raw/${assertPlatform(platform)}.md`;
}
