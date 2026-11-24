import { z } from "zod";

// Frontmatter for content/weeks/<week>/days/<date>/<channel>.md (ADR 0006, doc 04 section 3).
// Raw humanise text lives beside it as <channel>.raw.md (ADR 0007).

export const CHANNELS = ["linkedin", "instagram", "facebook"] as const;
export const FORMATS = ["text", "carousel"] as const;
export const STATUSES = ["draft", "reviewed", "rendered", "exported"] as const;
export const LENGTHS = ["micro", "short", "medium", "long", "extended", "custom"] as const;
export const EDIT_RATINGS = ["as-is", "light", "rewrite"] as const;
export const SWITCH_OVERRIDES = ["on", "off", "inherit"] as const;

export const ChannelSchema = z.enum(CHANNELS);
export const FormatSchema = z.enum(FORMATS);
export const StatusSchema = z.enum(STATUSES);
export const LengthSchema = z.enum(LENGTHS);

export const LintResultSchema = z.object({
  hard: z.array(z.string()),
  soft: z.array(z.string()),
});

export const PostFrontmatterSchema = z.object({
  id: z.string().min(1),
  channel: ChannelSchema,
  status: StatusSchema,
  topic: z.string().min(1),
  angle: z.string().min(1),
  format: FormatSchema,
  model: z.string().min(1),
  fallback_from: z.string().optional(),
  created: z.string().min(1), // ISO 8601 with local offset, e.g. 2026-11-24T09:00:00+05:30
  length: LengthSchema,
  custom_target: z.number().int().positive().optional(), // only when length is custom
  style: z.string().min(1),
  humanise: z.enum(SWITCH_OVERRIDES),
  humanised: z.boolean(),
  variant_index: z.number().int().positive(),
  selected: z.boolean(),
  rendered: z.boolean(),
  edit_rating: z.enum(EDIT_RATINGS).nullable(),
  review_required: z.boolean(),
  stale: z.boolean(),
  lint: LintResultSchema,
});

export type Channel = z.infer<typeof ChannelSchema>;
export type PostFrontmatter = z.infer<typeof PostFrontmatterSchema>;
export type Status = z.infer<typeof StatusSchema>;
