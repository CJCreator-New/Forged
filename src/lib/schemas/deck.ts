import { z } from "zod";

// Deck JSON (doc 03 section 3, prompt P6). Decks exist only for LinkedIn and Instagram (decision: Facebook text only).

export const DECK_THEMES = ["clean-light", "dark-tech", "warm-paper"] as const;
export const SLIDE_TYPES = ["cover", "point", "stat", "quote", "cta"] as const;

export const ColorsSchema = z.object({
  bg: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  text: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  muted: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const StylingSchema = z.object({
  corner: z.enum(["square", "rounded", "very-rounded"]),
  card: z.enum(["flat", "outlined", "shadow"]),
  padding: z.enum(["small", "medium", "large"]),
});

export const SlideSchema = z.object({
  type: z.enum(SLIDE_TYPES),
  title: z.string().min(1).max(60),
  body: z.string().max(400), // at most 3 lines, checked in lines() below
  icon: z.string().optional(), // Lucide icon name, only when icons are on
});

export const DeckSchema = z
  .object({
    deck_id: z.string().min(1),
    channel: z.enum(["linkedin", "instagram"]),
    size: z.object({ w: z.literal(1080), h: z.literal(1350) }),
    theme: z.enum(DECK_THEMES),
    colors: ColorsSchema,
    styling: StylingSchema,
    slides: z.array(SlideSchema).min(7).max(10),
  })
  .superRefine((deck, ctx) => {
    if (deck.slides[0] && deck.slides[0].type !== "cover") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "First slide must be cover." });
    }
    const last = deck.slides[deck.slides.length - 1];
    if (last && last.type !== "cta") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Last slide must be cta." });
    }
    deck.slides.forEach((s, i) => {
      if (s.body.split("\n").filter((l) => l.trim() !== "").length > 3) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Slide ${i + 1} body has more than 3 lines.` });
      }
    });
  });

export type Deck = z.infer<typeof DeckSchema>;
