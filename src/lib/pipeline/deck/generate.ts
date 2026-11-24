import { readSwitches } from "../../config/switches";
import { GatewayError } from "../../gateway/errors";
import { runJson } from "../../gateway/json";
import { DeckSchema, type Deck } from "../../schemas/deck";
import { readMarkdown } from "../../store/markdown";
import { readPost, StoreError } from "../../store/posts";
import { DeckExtrasSchema, LogoSettingsSchema, type DeckExtras, type LogoSettings } from "./extras";
import { isNotFound, issuesText, RouteError } from "./http";
import { buildSlidesPrompt, SlidesReplySchema } from "./prompt";
import { deckRelFor, parseDeckPath, parsePostPath, type Channel } from "./paths";
import { deckFileExists, readDeckFile, writeDeckFile } from "./file";
import { THEME_COLORS, type DeckColors, type DeckTheme } from "./themes";

// Facebook never gets a deck (decision in docs/decisions.md).
export function assertDeckChannel(channel: Channel): asserts channel is "linkedin" | "instagram" {
  if (channel === "facebook") {
    throw new RouteError(422, "no_deck_for_channel", "Facebook has no carousel deck in v1. Facebook posts are text only.");
  }
}

// Reads a post and maps store errors to route errors.
export async function loadPost(postRel: string) {
  try {
    return await readPost(postRel);
  } catch (err) {
    if (err instanceof StoreError) throw new RouteError(422, "invalid_post", err.message);
    if (isNotFound(err)) throw new RouteError(404, "post_not_found", "No post was found at that path.");
    throw err;
  }
}

async function readPillar(weekRel: string): Promise<string> {
  try {
    return (await readMarkdown(`${weekRel}/pillar.md`)).body.trim();
  } catch (err) {
    if (isNotFound(err)) return "";
    throw err;
  }
}

// Builds the full deck from the model's slides plus the app's defaults. Throws invalid_deck with the zod message.
export function assembleDeck(input: {
  deckId: string;
  channel: "linkedin" | "instagram";
  theme: string;
  colors: Partial<DeckColors>;
  styling: unknown;
  slides: unknown;
}): Deck {
  const knownColors = (THEME_COLORS as Record<string, DeckColors | undefined>)[input.theme];
  const candidate = {
    deck_id: input.deckId,
    channel: input.channel,
    size: { w: 1080, h: 1350 },
    theme: input.theme,
    colors: { ...(knownColors ?? THEME_COLORS["clean-light"]), ...input.colors },
    styling: input.styling,
    slides: input.slides,
  };
  const parsed = DeckSchema.safeParse(candidate);
  if (!parsed.success) throw new RouteError(422, "invalid_deck", issuesText(parsed.error.issues));
  return parsed.data;
}

export async function generateDeck(input: {
  postPath: string;
  theme?: DeckTheme;
  colors?: Partial<DeckColors>;
  replace: boolean;
}): Promise<{ deck_path: string }> {
  const ref = parsePostPath(input.postPath);
  if (!ref) {
    throw new RouteError(400, "bad_path", "post_path must look like weeks/<week>/days/<date>/<channel>.md.");
  }
  assertDeckChannel(ref.channel);

  const post = await loadPost(input.postPath);
  assertDeckChannel(post.frontmatter.channel);
  const channel = post.frontmatter.channel;
  if (channel !== ref.channel) {
    throw new RouteError(422, "invalid_post", "The post's channel does not match its file name.");
  }

  const deckRel = deckRelFor(ref.dayRel, channel);
  if (!input.replace && (await deckFileExists(deckRel))) {
    throw new RouteError(409, "deck_exists", "A deck already exists for this post. Send replace: true to overwrite it.");
  }

  const switches = readSwitches();
  const prompt = buildSlidesPrompt({
    angle: post.frontmatter.angle,
    pillar: await readPillar(ref.weekRel),
    postBody: post.body.trim(),
  });

  let slides: unknown;
  try {
    const reply = await runJson("slides", [{ role: "user", content: prompt }], SlidesReplySchema);
    slides = reply.data.slides;
  } catch (err) {
    if (err instanceof GatewayError && err.code === "invalid_output") {
      throw new RouteError(422, "invalid_deck", err.message);
    }
    throw err;
  }

  const deck = assembleDeck({
    deckId: post.frontmatter.id,
    channel,
    theme: input.theme ?? switches.theme,
    colors: input.colors ?? {},
    styling: switches.styling,
    slides,
  });

  const logo = LogoSettingsSchema.safeParse(switches.logo);
  if (!logo.success) throw new RouteError(422, "invalid_deck", "Logo settings in config/features.json are invalid.");
  const extras: DeckExtras = { icons: switches.icons, logo: logo.data };

  await writeDeckFile(deckRel, deck, extras, input.replace);
  return { deck_path: deckRel };
}

// Changes styling only. Slide titles and bodies are copied through untouched.
export async function patchDeck(input: {
  deckPath: string;
  theme?: DeckTheme;
  colors?: Partial<DeckColors>;
  styling?: Partial<Deck["styling"]>;
  icons?: boolean;
  logo?: Partial<LogoSettings>;
}): Promise<{ deck_path: string }> {
  const ref = parseDeckPath(input.deckPath);
  if (!ref) {
    throw new RouteError(400, "bad_path", "deck_path must look like weeks/<week>/days/<date>/<channel>-deck.json.");
  }
  assertDeckChannel(ref.channel);

  const { deck, extras } = await readDeckFile(input.deckPath);
  const next = DeckSchema.safeParse({
    ...deck,
    theme: input.theme ?? deck.theme,
    colors: { ...deck.colors, ...input.colors },
    styling: { ...deck.styling, ...input.styling },
  });
  if (!next.success) throw new RouteError(422, "invalid_deck", issuesText(next.error.issues));

  const nextExtras = DeckExtrasSchema.safeParse({
    icons: input.icons ?? extras.icons,
    logo: { ...extras.logo, ...input.logo },
  });
  if (!nextExtras.success) throw new RouteError(422, "invalid_deck", issuesText(nextExtras.error.issues));

  await writeDeckFile(input.deckPath, next.data, nextExtras.data, true);
  return { deck_path: input.deckPath };
}
