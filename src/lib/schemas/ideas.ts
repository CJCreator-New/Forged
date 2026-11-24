import { z } from "zod";
import { FormatSchema } from "./post";

// Output of prompt P1 (doc 04 section 7). Model output is validated with this before display.
// source_urls may only contain URLs from the trend context (ADR 0007 and doc 04 P1).

export const AngleSchema = z.object({
  title: z.string().min(1),
  hooks: z.array(z.string().min(1)).length(3),
  format: FormatSchema,
  why_it_could_travel: z.string().min(1),
  source_urls: z.array(z.string().url()),
});

export const IdeasSchema = z.array(AngleSchema).min(5).max(10);

export type Angle = z.infer<typeof AngleSchema>;
