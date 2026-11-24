import { z } from "zod";

// Per-deck settings that DeckSchema does not hold yet. They sit beside the deck fields in the same JSON file.
export const LOGO_CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
export const LOGO_SIZES = ["small", "medium", "large"] as const;

export const LogoSettingsSchema = z
  .object({
    enabled: z.boolean(),
    corner: z.enum(LOGO_CORNERS),
    size: z.enum(LOGO_SIZES),
    opacity: z.number().min(0.6).max(1),
    all_slides: z.boolean(),
  })
  .strict();

// icons: whether icons are drawn when the deck renders. The model's icon names are always kept in the file.
export const DeckExtrasSchema = z.object({
  icons: z.boolean(),
  logo: LogoSettingsSchema,
});

export type LogoSettings = z.infer<typeof LogoSettingsSchema>;
export type DeckExtras = z.infer<typeof DeckExtrasSchema>;
