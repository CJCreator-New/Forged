import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as render from "../render/render";
import { resolveContentPath } from "../store/paths";
import { hashBody, isUserEdited, readPost, writePost } from "../store/posts";
import { exportDeck } from "./deck";
import { ExportError } from "./errors";
import { exportPost } from "./post";
import { packWeek, planWeek } from "./week";

// Each test works in its own folder under content/, which is removed afterwards.
vi.mock("../render/render", () => ({
  renderDeck: vi.fn(),
  renderSlidePng: vi.fn(),
}));

const WEEK = "2026-W48";
const DAY = "2026-11-24";
let base: string;
const created: string[] = [];

beforeEach(() => {
  base = `_test_${Math.random().toString(36).slice(2, 10)}`;
  created.push(base);
  vi.mocked(render.renderDeck).mockClear();
});

afterEach(async () => {
  for (const folder of created.splice(0)) {
    await fs.rm(resolveContentPath(folder), { recursive: true, force: true });
  }
});

const CLEAN_BODY = [
  "Small wins add up at work.",
  "",
  "We automated one weekly report last month and saved two hours every Monday.",
  "",
  "What step would you automate first?",
  "",
  "Hashtags: #AI #Operations",
  "Alt text: A simple chart of hours saved per week.",
].join("\n");

const HARD_BODY = "Small wins add up at work " + String.fromCharCode(0x2014) + " read on. #AI #Operations";

function frontmatter(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    channel: "linkedin",
    status: "draft",
    topic: "AI at work",
    angle: "Small wins",
    format: "text",
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    created: "2026-11-24T09:00:00+05:30",
    length: "medium",
    style: "direct",
    humanise: "inherit",
    humanised: false,
    variant_index: 1,
    selected: true,
    rendered: false,
    edit_rating: null,
    review_required: false,
    stale: false,
    lint: { hard: [], soft: [] },
    ...overrides,
  };
}

function dayRel(file: string): string {
  return `${base}/weeks/${WEEK}/days/${DAY}/${file}`;
}

async function writeFile(rel: string, data: string | Buffer): Promise<void> {
  const file = resolveContentPath(rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
}

const deckJson = {
  deck_id: "deck-1",
  channel: "instagram",
  size: { w: 1080, h: 1350 },
  theme: "clean-light",
  colors: { bg: "#ffffff", text: "#111111", accent: "#2255ff", muted: "#888888" },
  styling: { corner: "rounded", card: "flat", padding: "medium" },
  slides: [
    { type: "cover", title: "Cover", body: "Hello" },
    { type: "point", title: "One", body: "First point" },
    { type: "point", title: "Two", body: "Second point" },
    { type: "point", title: "Three", body: "Third point" },
    { type: "point", title: "Four", body: "Fourth point" },
    { type: "point", title: "Five", body: "Fifth point" },
    { type: "cta", title: "Next", body: "Follow along" },
  ],
};

describe("post export (S6.1)", () => {
  it("refuses a post with a hard lint failure and changes nothing", async () => {
    await writePost(dayRel("linkedin.md"), frontmatter(), HARD_BODY);
    const err = await exportPost(dayRel("linkedin.md"), { reviewConfirmed: false }).catch((e) => e);
    expect(err).toBeInstanceOf(ExportError);
    expect((err as ExportError).code).toBe("hard_lint_failed");
    const { frontmatter: fm } = await readPost(dayRel("linkedin.md"));
    expect(fm.status).toBe("draft");
  });

  it("refuses a review-required post with no tick, and exports it with the tick", async () => {
    await writePost(dayRel("linkedin.md"), frontmatter({ review_required: true }), CLEAN_BODY);
    const refused = await exportPost(dayRel("linkedin.md"), { reviewConfirmed: false }).catch((e) => e);
    expect((refused as ExportError).code).toBe("review_required");

    const ok = await exportPost(dayRel("linkedin.md"), { reviewConfirmed: true });
    expect(ok.filename).toBe(`linkedin-${DAY}.md`);
    expect(ok.markdown).toContain("Small wins add up at work.");
    expect(ok.markdown).toContain("Hashtags: #AI #Operations");
    expect(ok.markdown).toContain("Alt text: A simple chart of hours saved per week.");
    expect(ok.markdown.match(/Hashtags:/g)).toHaveLength(1);
  });

  it("marks the post exported and keeps the body and body_hash unchanged", async () => {
    await writePost(dayRel("linkedin.md"), frontmatter(), CLEAN_BODY);
    const before = await readPost(dayRel("linkedin.md"));

    await exportPost(dayRel("linkedin.md"), { reviewConfirmed: false });

    const after = await readPost(dayRel("linkedin.md"));
    expect(after.frontmatter.status).toBe("exported");
    expect(after.body).toBe(before.body);
    expect(after.frontmatter.body_hash).toBe(before.frontmatter.body_hash);
    expect(hashBody(after.body)).toBe(after.frontmatter.body_hash);
    expect(await isUserEdited(dayRel("linkedin.md"))).toBe(false);
  });

  it("rejects a path outside content/", async () => {
    const err = await exportPost("../secret.md", { reviewConfirmed: false }).catch((e) => e);
    expect((err as ExportError).code).toBe("bad_path");
  });
});

describe("deck export (S6.2)", () => {
  const deckRel = () => `${base}/weeks/${WEEK}/days/${DAY}/instagram-deck.json`;

  it("returns not_rendered and never calls renderDeck when there are no renders", async () => {
    await writeFile(deckRel(), JSON.stringify(deckJson));
    const err = await exportDeck(deckRel(), "png").catch((e) => e);
    expect((err as ExportError).code).toBe("not_rendered");
    expect((err as ExportError).message).toBe("Render this deck first.");
    await expect(exportDeck(deckRel(), "pdf")).rejects.toMatchObject({ code: "not_rendered" });
    expect(render.renderDeck).not.toHaveBeenCalled();
  });

  it("treats a partial PNG set as not rendered", async () => {
    await writeFile(deckRel(), JSON.stringify(deckJson));
    for (let i = 1; i <= 6; i += 1) {
      await writeFile(`${base}/weeks/${WEEK}/days/${DAY}/renders/instagram/slide-0${i}.png`, Buffer.from("png"));
    }
    await expect(exportDeck(deckRel(), "png")).rejects.toMatchObject({ code: "not_rendered" });
  });

  it("returns deck.pdf and a PNG ZIP when the renders exist", async () => {
    await writeFile(deckRel(), JSON.stringify(deckJson));
    await writeFile(`${base}/weeks/${WEEK}/days/${DAY}/renders/instagram/deck.pdf`, Buffer.from("%PDF-1.4 test"));
    const pdf = await exportDeck(deckRel(), "pdf");
    expect(pdf.contentType).toBe("application/pdf");
    expect(pdf.body.toString("utf8")).toContain("%PDF");

    for (let i = 1; i <= 7; i += 1) {
      await writeFile(
        `${base}/weeks/${WEEK}/days/${DAY}/renders/instagram/slide-${String(i).padStart(2, "0")}.png`,
        Buffer.from(`png-${i}`),
      );
    }
    const png = await exportDeck(deckRel(), "png");
    expect(png.contentType).toBe("application/zip");
    expect(png.body.includes(Buffer.from("slide-07.png"))).toBe(true);
    expect(png.body.includes(Buffer.from("alt.txt"))).toBe(true);
    expect(render.renderDeck).not.toHaveBeenCalled();
  });
});

describe("week ZIP (S6.3)", () => {
  async function seedWeek(): Promise<void> {
    const weekRel = `${base}/weeks/${WEEK}/days/${DAY}`;
    await writePost(`${weekRel}/linkedin.md`, frontmatter(), CLEAN_BODY);
    await writePost(
      `${weekRel}/instagram.md`,
      frontmatter({ id: "post-2", channel: "instagram", status: "reviewed", stale: true }),
      CLEAN_BODY,
    );
    await writePost(
      `${weekRel}/facebook.md`,
      frontmatter({ id: "post-3", channel: "facebook", review_required: true }),
      HARD_BODY,
    );
    await writeFile(`${weekRel}/instagram-deck.json`, JSON.stringify(deckJson));
    await writeFile(`${weekRel}/renders/slide-01.png`, Buffer.from("png"));
  }

  async function zipBytes(stream: AsyncIterable<Buffer>): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  it("lists every post and includes README.md in the ZIP", async () => {
    await seedWeek();
    const plan = await planWeek(WEEK, `${base}/weeks`);
    const zip = await zipBytes(packWeek(plan));
    expect(zip.includes(Buffer.from("README.md"))).toBe(true);
    for (const name of ["linkedin.md", "instagram.md", "facebook.md", "instagram-deck.json", "slide-01.png"]) {
      expect(zip.includes(Buffer.from(name))).toBe(true);
    }
  });

  it("README shows each file's status, flags stale posts, and marks hard failures as draft", async () => {
    await seedWeek();
    const { readme } = await planWeek(WEEK, `${base}/weeks`);
    expect(readme).toContain("linkedin.md: channel linkedin, status draft, stale: no");
    expect(readme).toContain("instagram.md: channel instagram, status reviewed, stale: yes");
    expect(readme).toContain("facebook.md: channel facebook, status draft (not exportable yet)");
    expect(readme).toContain("review tick missing: yes");
    expect(readme).not.toContain(process.cwd());
  });

  it("lists an unreadable post in the README without failing", async () => {
    await seedWeek();
    await writeFile(`${base}/weeks/${WEEK}/days/${DAY}/broken.md`, "no frontmatter here");
    const { readme } = await planWeek(WEEK, `${base}/weeks`);
    expect(readme).toContain("broken.md: could not be read");
  });
});
