import { z } from "zod";
import { CHANNELS, LENGTHS } from "./post";

// Shapes of config/models.json, config/channels.json, and config/styles/*.json.

// config/models.json: fixed fallback order per task. Primary model names come from the
// live OpenRouter list at runtime (ADR 0002, amended). This file holds the default order only.
export const TASKS = ["ideas", "pillar", "adapt", "slides", "humanise", "variants", "enhance", "trend"] as const;

export const ModelsConfigSchema = z.object({
  tasks: z.record(
    z.enum(TASKS),
    z.object({
      primary: z.string().min(1),
      fallback: z.array(z.string().min(1)),
    }),
  ),
});

// config/channels.json: hard max is confirmed or provisional per channel. Ranges are the body target.
export const LengthRangeSchema = z.object({
  min: z.number().int().nonnegative(),
  max: z.number().int().positive(),
  unit: z.enum(["characters", "words"]),
});

export const ChannelConfigSchema = z.object({
  hook_max_chars: z.number().int().positive(),
  hard_max_chars: z.number().int().positive(),
  hard_max_provisional: z.boolean(), // true when the source is secondary only
  hashtags: z.object({ min: z.number().int().nonnegative(), max: z.number().int().positive() }),
  lengths: z.object(
    Object.fromEntries(LENGTHS.filter((l) => l !== "custom").map((l) => [l, LengthRangeSchema])) as Record<
      Exclude<(typeof LENGTHS)[number], "custom">,
      typeof LengthRangeSchema
    >,
  ),
});

export const ChannelsConfigSchema = z.object(
  Object.fromEntries(CHANNELS.map((c) => [c, ChannelConfigSchema])) as Record<
    (typeof CHANNELS)[number],
    typeof ChannelConfigSchema
  >,
);

// config/styles/<id>.json: one writing style preset. Styles shape the post and never add facts.
export const StyleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  guidance: z.string().min(1),
});

export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;
export type ChannelsConfig = z.infer<typeof ChannelsConfigSchema>;
export type Style = z.infer<typeof StyleSchema>;
