import { promises as fs } from "node:fs";
import { readSwitches } from "../../config/switches";
import { renderDeck, type LogoOptions } from "../../render/render";
import { resolveContentPath } from "../../store/paths";
import type { Deck } from "../../schemas/deck";
import { logoSlot } from "../../assets/logo";
import { findLogoFile, logoOptionsFor } from "./logo";
import { RouteError } from "./http";
import { parseDeckPath, rendersRelFor, toContentRel } from "./paths";
import { readDeckFile } from "./file";
import { loadPost } from "./generate";

// Alt text: one line per slide, built from the slide title and body.
export function buildAltText(deck: Deck): string {
  const total = deck.slides.length;
  return deck.slides
    .map((slide, i) => {
      const body = slide.body
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "")
        .join(" ");
      return `Slide ${i + 1} of ${total}: ${slide.title}.${body ? ` ${body}` : ""}`.replace(/\s+/g, " ").trim();
    })
    .join("\n");
}

// Renders one deck into renders/ beside the deck file. Refused unless carousel rendering is on.
// The switch is checked first, so with it off no file is read and no browser starts.
export async function renderDeckFiles(input: {
  deckPath: string;
  pdf: boolean;
}): Promise<{ renders: string[]; alt_path: string }> {
  if (readSwitches().carousel_render !== true) {
    throw new RouteError(403, "feature_off", "Carousel rendering is off. Turn it on in the feature switches first.");
  }

  const ref = parseDeckPath(input.deckPath);
  if (!ref) {
    throw new RouteError(400, "bad_path", "deck_path must look like weeks/<week>/days/<date>/<channel>-deck.json.");
  }
  if (ref.channel === "facebook") {
    throw new RouteError(422, "no_deck_for_channel", "Facebook has no carousel deck in v1.");
  }

  const { deck, extras } = await readDeckFile(input.deckPath);
  const post = await loadPost(`${ref.dayRel}/${ref.channel}.md`);
  if (post.frontmatter.format !== "carousel") {
    throw new RouteError(422, "not_carousel", "Carousel rendering is not on for this post.");
  }

  const logoFile = await findLogoFile();
  const showLogo = logoSlot({ logoPresent: logoFile !== null, enabled: extras.logo.enabled }) === "shown";
  const logo: LogoOptions | undefined = showLogo && logoFile ? logoOptionsFor(logoFile, extras.logo) : undefined;

  // Icons off: the slide copies lose their icon names. The deck file keeps them.
  const slides = deck.slides.map((slide) => {
    const copy = { ...slide };
    if (!extras.icons) delete copy.icon;
    return copy;
  });

  const rendersRel = rendersRelFor(ref.dayRel, ref.channel);
  const outDir = resolveContentPath(rendersRel);
  await fs.mkdir(outDir, { recursive: true });

  let files: string[];
  try {
    files = await renderDeck({ ...deck, slides }, outDir, {
      pdf: input.pdf && ref.channel === "linkedin",
      logo,
      logoOnAllSlides: extras.logo.all_slides,
    });
  } catch (err) {
    throw new RouteError(422, "render_failed", err instanceof Error ? err.message : "Rendering failed.");
  }

  const altRel = `${rendersRel}/alt.txt`;
  await fs.writeFile(resolveContentPath(altRel), buildAltText(deck) + "\n", "utf8");
  return { renders: files.map(toContentRel), alt_path: altRel };
}
