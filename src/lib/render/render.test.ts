import { mkdtemp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { describe, expect, it, vi, type Mock } from "vitest";
import type { Deck } from "../schemas/deck";
import { buildSlideHtml, renderDeck } from "./render";

// Wrap launch in a spy that still runs the real browser, so the import test can count calls.
vi.mock("playwright", async (importOriginal) => {
  const actual = await importOriginal<typeof import("playwright")>();
  const launch = vi.fn((...args: Parameters<typeof actual.chromium.launch>) => actual.chromium.launch(...args));
  return { ...actual, chromium: { launch } };
});

const COLORS = {
  "clean-light": { bg: "#ffffff", text: "#111827", accent: "#2563eb", muted: "#6b7280" },
  "dark-tech": { bg: "#0b1220", text: "#f5f7fa", accent: "#4fd1c5", muted: "#8a94a6" },
  "warm-paper": { bg: "#f7f1e5", text: "#2b1d14", accent: "#d9692b", muted: "#7a6a5c" },
} as const;

function sampleDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    deck_id: "2026-11-24-test-01",
    channel: "linkedin",
    size: { w: 1080, h: 1350 },
    theme: "dark-tech",
    colors: COLORS["dark-tech"],
    styling: { corner: "rounded", card: "flat", padding: "medium" },
    slides: [
      { type: "cover", title: "Short title", body: "One line" },
      { type: "point", title: "First point", body: "Line one\nLine two", icon: "users" },
      { type: "point", title: "Second point", body: "Only line", icon: "cpu" },
      { type: "point", title: "Third point", body: "A point", icon: "shield" },
      { type: "stat", title: "42%", body: "What it measures", icon: "bar-chart" },
      { type: "quote", title: "A short quote", body: "Someone Useful" },
      { type: "cta", title: "Question for the reader", body: "", icon: "message-circle" },
    ],
    ...overrides,
  };
}

describe("buildSlideHtml (pure, no browser)", () => {
  it.each(Object.keys(COLORS) as (keyof typeof COLORS)[])("uses the colour tokens for the %s theme", (theme) => {
    const colors = COLORS[theme];
    const html = buildSlideHtml(sampleDeck({ theme, colors }), 0);
    expect(html).toContain(colors.bg);
    expect(html).toContain(colors.text);
    expect(html).toContain(colors.accent);
    expect(html).toContain(colors.muted);
  });

  it("leaves no unfilled placeholders", () => {
    const html = buildSlideHtml(sampleDeck(), 1);
    expect(html).not.toMatch(/\{\{\w+\}\}/);
  });

  it("escapes a title containing a script tag", () => {
    const deck = sampleDeck();
    deck.slides[0].title = `<script>alert("x")</script> & 'quotes'`;
    const html = buildSlideHtml(deck, 0);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quotes&#39;");
  });

  it("renders no icon element on a cover slide without an icon", () => {
    const html = buildSlideHtml(sampleDeck(), 0);
    expect(html).not.toContain("data-icon");
    expect(html).not.toContain('class="icon"');
  });

  it("renders an icon placeholder when the slide has an icon", () => {
    const html = buildSlideHtml(sampleDeck(), 1);
    expect(html).toContain('<svg class="icon" data-icon="users"');
  });

  it("maps very-rounded corners to a 24px radius", () => {
    const deck = sampleDeck({ styling: { corner: "very-rounded", card: "flat", padding: "medium" } });
    expect(buildSlideHtml(deck, 0)).toContain("border-radius: 24px;");
  });

  it("maps square corners to 0px", () => {
    const deck = sampleDeck({ styling: { corner: "square", card: "flat", padding: "medium" } });
    expect(buildSlideHtml(deck, 0)).toContain("border-radius: 0px;");
  });

  it("maps large padding to 96px", () => {
    const deck = sampleDeck({ styling: { corner: "rounded", card: "flat", padding: "large" } });
    expect(buildSlideHtml(deck, 0)).toContain("padding: 96px;");
  });

  it("draws an outlined card with a 2px border in the muted colour", () => {
    const deck = sampleDeck({ styling: { corner: "rounded", card: "outlined", padding: "medium" } });
    expect(buildSlideHtml(deck, 0)).toContain(`border: 2px solid ${COLORS["dark-tech"].muted}`);
  });

  it("shows the page as position of total", () => {
    expect(buildSlideHtml(sampleDeck(), 2)).toContain("3 / 7");
  });

  it("shows the logo on cover and CTA slides only by default", () => {
    const deck = sampleDeck();
    const logo = { x: 60, y: 60, width: 120, height: 120, opacity: 0.8, src: "data:image/png;base64,AAAA" };
    expect(buildSlideHtml(deck, 0)).not.toContain('class="logo"');
    const cover = buildSlideHtml(deck, 0, { logo });
    expect(cover).toContain('class="logo"');
    expect(cover).toContain("left: 60px; top: 60px; width: 120px; height: 120px; opacity: 0.8;");
    expect(buildSlideHtml(deck, 1, { logo })).not.toContain('class="logo"');
    expect(buildSlideHtml(deck, 6, { logo })).toContain('class="logo"');
  });

  it("shows the logo on every slide when logoOnAllSlides is set", () => {
    const deck = sampleDeck();
    const logo = { x: 60, y: 60, width: 120, height: 120, opacity: 1, src: "data:image/png;base64,AAAA" };
    expect(buildSlideHtml(deck, 2, { logo, logoOnAllSlides: true })).toContain('class="logo"');
  });

  it("rejects a slide index outside the deck", () => {
    expect(() => buildSlideHtml(sampleDeck(), 7)).toThrow("out of range");
  });

  it("builds a slide from a draft deck with fewer than 7 slides", () => {
    const deck = sampleDeck({ slides: sampleDeck().slides.slice(0, 2) });
    expect(buildSlideHtml(deck, 1)).toContain("First point");
  });

  it("rejects a colour that is not 6-digit hex", () => {
    const deck = sampleDeck({ colors: { ...COLORS["dark-tech"], accent: "red;}body{" } });
    expect(() => buildSlideHtml(deck, 0)).toThrow("6-digit hex");
  });

  it("refuses to render an invalid deck before any browser starts", async () => {
    const deck = sampleDeck({ slides: sampleDeck().slides.slice(0, 3) });
    await expect(renderDeck(deck, join(tmpdir(), "postline-never-written"), { pdf: false })).rejects.toThrow(
      "Deck is invalid",
    );
  });
});

describe("module import (mocked playwright)", () => {
  it("does not launch a browser when the module is imported", async () => {
    vi.resetModules();
    const pw = await import("playwright");
    const launch = pw.chromium.launch as unknown as Mock;
    launch.mockClear();
    await import("./render");
    expect(launch).not.toHaveBeenCalled();
  });
});

// Returns null when Chromium can start, otherwise the reason it cannot.
async function probeChromium(): Promise<string | null> {
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message.split("\n")[0] : String(error);
  }
}

async function makeScratchDir(): Promise<string> {
  const base = process.env.CLAUDE_JOB_DIR ? join(process.env.CLAUDE_JOB_DIR, "tmp") : tmpdir();
  await mkdir(base, { recursive: true });
  return mkdtemp(join(base, "postline-render-"));
}

describe("real render (needs Chromium)", () => {
  it("renders a 7-slide deck to 7 PNG files over 1 KB each", async (ctx) => {
    const problem = await probeChromium();
    if (problem) ctx.skip(`Skipped: Chromium is not available (${problem}). Run "npx playwright install chromium".`);

    const dir = await makeScratchDir();
    try {
      const paths = await renderDeck(sampleDeck(), dir, { pdf: false });
      expect(paths).toHaveLength(7);
      const pngs = (await readdir(dir)).filter((name) => /^slide-\d{2}\.png$/.test(name));
      expect(pngs).toHaveLength(7);
      for (const name of pngs) {
        expect((await stat(join(dir, name))).size).toBeGreaterThan(1024);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 120_000);

  it("writes deck.pdf next to the PNGs when pdf is true", async (ctx) => {
    const problem = await probeChromium();
    if (problem) ctx.skip(`Skipped: Chromium is not available (${problem}). Run "npx playwright install chromium".`);

    const dir = await makeScratchDir();
    try {
      await renderDeck(sampleDeck(), dir, { pdf: true });
      expect((await stat(join(dir, "deck.pdf"))).size).toBeGreaterThan(1024);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
