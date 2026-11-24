import { z } from "zod";
import { ChannelSchema, EDIT_RATINGS, FormatSchema, LengthSchema } from "./post";

// One row of content/log.md (doc 04 section 9, with channel instead of platform per decisions).
// The app writes every column except reach and followers, which are entered by hand.

export const LogRowSchema = z.object({
  date: z.string().min(1),
  post_id: z.string().min(1),
  channel: ChannelSchema,
  topic: z.string().min(1),
  format: FormatSchema,
  length: LengthSchema,
  variant: z.number().int().positive(),
  minutes: z.number().nonnegative().nullable(),
  edit_rating: z.enum(EDIT_RATINGS).nullable(),
  reach: z.number().nonnegative().nullable(), // only rows with reach count toward the threshold
  followers: z.number().int().nullable(),
});

export type LogRow = z.infer<typeof LogRowSchema>;
