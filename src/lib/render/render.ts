import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { chromium, type Browser } from "playwright";
import { DeckSchema, type Deck } from "../schemas/deck";

// Slide renderer (ADR 0003). Importing this module launches nothing.
// A browser is started only inside renderSlidePng and renderDeck.

export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export type LogoOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number; // 0 to 1
  src: string; // a data:image/ URI, or a local PNG or SVG path
};

export type RenderOptions = {
  logo?: LogoOptions;
  logoOnAllSlides?: boolean; // default false: the logo shows on cover and CTA slides only
};

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

type Theme = Deck["theme"];

const THEME_FILES: Record<Theme, string> = {
  "clean-light": "clean-light.html",
  "dark-tech": "dark-tech.html",
  "warm-paper": "warm-paper.html",
};

const RADIUS: Record<Deck["styling"]["corner"], string> = {
  square: "0px",
  rounded: "12px",
  "very-rounded": "24px",
};

const PADDING: Record<Deck["styling"]["padding"], string> = {
  small: "48px",
  medium: "72px",
  large: "96px",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function assertValidDeck(deck: unknown): asserts deck is Deck {
  const parsed = DeckSchema.safeParse(deck);
  if (!parsed.success) {
    throw new Error(`Deck is invalid: ${parsed.error.message}`);
  }
}

function cardCss(card: Deck["styling"]["card"], colors: Deck["colors"]): string {
  switch (card) {
    case "flat":
      return "background: transparent; border: 0; box-shadow: none;";
    case "outlined":
      return `background: transparent; border: 2px solid ${colors.muted}; box-shadow: none;`;
    case "shadow":
      return `background: ${colors.bg}; border: 0; box-shadow: 0 24px 48px rgba(0, 0, 0, 0.18);`;
  }
}

function logoDataUri(src: string): string {
  if (src.startsWith("data:image/")) return src;
  const types: Record<string, string> = { ".png": "image/png", ".svg": "image/svg+xml" };
  const mime = types[extname(src).toLowerCase()];
  if (!mime) throw new Error(`Logo must be a PNG or SVG file: ${basename(src)}`);
  const bytes = readFileSync(src);
  if (bytes.length > LOGO_MAX_BYTES) throw new Error("Logo is larger than 2 MB.");
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function logoHtml(logo: LogoOptions | undefined): string {
  if (!logo) return "";
  const nums = [logo.x, logo.y, logo.width, logo.height, logo.opacity];
  if (!nums.every((n) => Number.isFinite(n))) throw new Error("Logo position, size and opacity must be numbers.");
  if (logo.width <= 0 || logo.height <= 0) throw new Error("Logo width and height must be positive.");
  if (logo.opacity < 0 || logo.opacity > 1) throw new Error("Logo opacity must be between 0 and 1.");
  const src = logoDataUri(logo.src);
  return `<img class="logo" alt="" src="${escapeHtml(src)}" style="left: ${logo.x}px; top: ${logo.y}px; width: ${logo.width}px; height: ${logo.height}px; opacity: ${logo.opacity};">`;
}

function slideCardHtml(slide: Deck["slides"][number]): string {
  const lines = slide.body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const icon = slide.icon
    ? `<svg class="icon" data-icon="${escapeHtml(slide.icon)}" viewBox="0 0 24 24" aria-hidden="true"></svg>`
    : "";
  const body = lines.length > 0 ? `<div class="body">${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}</div>` : "";
  return `<div class="card slide-${escapeHtml(slide.type)}">${icon}<h1 class="title">${escapeHtml(slide.title)}</h1>${body}</div>`;
}

function loadTemplate(theme: Theme): string {
  return readFileSync(join(process.cwd(), "templates", THEME_FILES[theme]), "utf8");
}

// One pass over the template, so text inserted from the deck is never scanned for tokens.
function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (token, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : token,
  );
}

// Inter is inlined from public/fonts/Inter.woff2 when that file exists. Otherwise the system-ui fallback applies.
function fontFaceCss(): string {
  const fontPath = join(process.cwd(), "public", "fonts", "Inter.woff2");
  if (!existsSync(fontPath)) return "";
  const data = readFileSync(fontPath).toString("base64");
  return `@font-face { font-family: "Inter"; src: url(data:font/woff2;base64,${data}) format("woff2"); font-weight: 100 900; font-style: normal; font-display: block; }`;
}

// Builds one slide. Full deck rules (7 to 10 slides, cover first, cta last) are checked by renderDeck and renderSlidePng.
// Colours go straight into CSS, so they are checked here too.
export function buildSlideHtml(deck: Deck, index: number, opts: RenderOptions = {}): string {
  if (!Number.isInteger(index) || index < 0 || index >= deck.slides.length) {
    throw new Error(`Slide index ${index} is out of range for ${deck.slides.length} slides.`);
  }
  for (const value of Object.values(deck.colors)) {
    if (!HEX_COLOUR.test(value)) throw new Error("Colours must be 6-digit hex values such as #0b1220.");
  }
  const slide = deck.slides[index];
  const showLogo = opts.logoOnAllSlides === true || slide.type === "cover" || slide.type === "cta";
  return fillTemplate(loadTemplate(deck.theme), {
    font_face: fontFaceCss(),
    bg: deck.colors.bg,
    text: deck.colors.text,
    accent: deck.colors.accent,
    muted: deck.colors.muted,
    radius: RADIUS[deck.styling.corner],
    card: cardCss(deck.styling.card, deck.colors),
    padding: PADDING[deck.styling.padding],
    slide_html: slideCardHtml(slide),
    logo_html: logoHtml(showLogo ? opts.logo : undefined),
    page: `${index + 1} / ${deck.slides.length}`,
  });
}

// One document holding every slide, one per printed page, for the LinkedIn PDF.
function buildDeckPdfHtml(deck: Deck, opts: RenderOptions): string {
  const docs = deck.slides.map((_, i) => buildSlideHtml(deck, i, opts));
  const bodyPattern = /<body[^>]*>([\s\S]*)<\/body>/i;
  const pages = docs.map((doc) => {
    const match = doc.match(bodyPattern);
    if (!match) throw new Error("Template is missing a body element.");
    return `<section class="pdf-page">${match[1]}</section>`;
  });
  const pdfStyle = `<style>
  html, body { height: auto !important; width: ${SLIDE_WIDTH}px !important; }
  .pdf-page { width: ${SLIDE_WIDTH}px; height: ${SLIDE_HEIGHT}px; overflow: hidden; break-after: page; page-break-after: always; }
  .pdf-page:last-child { break-after: auto; page-break-after: auto; }
  </style>`;
  return docs[0]
    .replace(/<\/head>/i, () => `${pdfStyle}</head>`)
    .replace(bodyPattern, () => `<body>${pages.join("")}</body>`);
}

async function withBrowser<T>(run: (browser: Browser) => Promise<T>): Promise<T> {
  const browser = await chromium.launch({ headless: true });
  try {
    return await run(browser);
  } finally {
    await browser.close();
  }
}

export async function renderSlidePng(
  deck: Deck,
  index: number,
  outPath: string,
  opts: RenderOptions = {},
): Promise<string> {
  assertValidDeck(deck);
  const html = buildSlideHtml(deck, index, opts);
  await mkdir(dirname(outPath), { recursive: true });
  await withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT } });
    try {
      await page.setContent(html, { waitUntil: "load" });
      await page.screenshot({ path: outPath, type: "png" });
    } finally {
      await page.close();
    }
  });
  return outPath;
}

export async function renderDeck(
  deck: Deck,
  outDir: string,
  opts: { pdf: boolean } & RenderOptions,
): Promise<string[]> {
  assertValidDeck(deck);
  const renderOpts: RenderOptions = { logo: opts.logo, logoOnAllSlides: opts.logoOnAllSlides };
  const slideHtml = deck.slides.map((_, i) => buildSlideHtml(deck, i, renderOpts));
  const pdfHtml = opts.pdf ? buildDeckPdfHtml(deck, renderOpts) : null;

  await mkdir(outDir, { recursive: true });
  const pngPaths = deck.slides.map((_, i) => join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`));
  const pdfPath = join(outDir, "deck.pdf");

  await withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT } });
    try {
      for (let i = 0; i < slideHtml.length; i++) {
        await page.setContent(slideHtml[i], { waitUntil: "load" });
        await page.screenshot({ path: pngPaths[i], type: "png" });
      }
      if (pdfHtml) {
        await page.setContent(pdfHtml, { waitUntil: "load" });
        await page.pdf({
          path: pdfPath,
          width: `${SLIDE_WIDTH}px`,
          height: `${SLIDE_HEIGHT}px`,
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: "0", right: "0", bottom: "0", left: "0" },
        });
      }
    } finally {
      await page.close();
    }
  });

  return pdfHtml ? [...pngPaths, pdfPath] : pngPaths;
}
