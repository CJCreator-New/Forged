import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayError } from "../../gateway/errors";
import { runJson } from "../../gateway/json";
import { renderDeck } from "../../render/render";
import { readSwitches, type Switches } from "../../config/switches";
import { CONTENT_ROOT } from "../../store/paths";
import { writeMarkdown } from "../../store/markdown";
import { DeckSchema } from "../../schemas/deck";
import { GET as getIcons } from "../../../app/api/icons/route";
import { GET as getLogo, POST as postLogo } from "../../../app/api/logo/route";
import { POST as postRender } from "../../../app/api/render/route";
import { PATCH as patchDeckRoute, POST as postDeck } from "../../../app/api/deck/route";
import { listIcons } from "./icons";
import { buildAltText } from "./render";

// Every test writes into a throwaway folder, never the real content/.
vi.mock("../../store/paths", async () => {
  const { mkdtempSync } = await import("node:fs");
  const os = await import("node:os");
  const pathMod = await import("node:path");
  const root = mkdtempSync(pathMod.join(os.tmpdir(), "postline-deck-test-"));
  return {
    CONTENT_ROOT: root,
    resolveContentPath(relativePath: string): string {
      if (typeof relativePath !== "string" || relativePath.length === 0) {
        throw new Error("Path must be a non-empty string.");
      }
      const absolute = pathMod.resolve(root, relativePath);
      const rel = pathMod.relative(root, absolute);
      if (rel === "" || rel.startsWith("..") || pathMod.isAbsolute(rel)) {
        throw new Error(`Path is outside content/: ${relativePath}`);
      }
      return absolute;
    },
  };
});

vi.mock("../../gateway/json", () => ({ runJson: vi.fn() }));
vi.mock("../../config/switches", () => ({ readSwitches: vi.fn() }));
vi.mock("../../render/render", () => ({
  renderDeck: vi.fn(async (deck: { slides: unknown[] }, outDir: string, opts: { pdf: boolean }) => {
    const files = deck.slides.map((_, i) => path.join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`));
    if (opts.pdf) files.push(path.join(outDir, "deck.pdf"));
    return files;
  }),
}));

const HOST = "http://127.0.0.1:3000";
const WEEK = "2099-W01";
const DAY = "2099-01-05";

const BASE_SWITCHES: Switches = {
  trend_mode: false,
  humanise: true,
  carousel_render: true,
  icons: false,
  theme: "clean-light",
  styling: { corner: "rounded", card: "flat", padding: "medium" },
  logo: { enabled: false, corner: "top-right", size: "small", opacity: 1, all_slides: false },
  variants: 2,
  length: "medium",
  performance_loop: { enabled: true, min_posts: 20, min_group: 3 },
  linter_soft_warnings: true,
};

const SEVEN_SLIDES = [
  { type: "cover", title: "Why small wins matter", body: "A short case for steady progress", icon: "sparkles" },
  { type: "point", title: "Pick one habit", body: "Choose a single habit\nKeep it under five minutes", icon: "check" },
  { type: "point", title: "Track it weekly", body: "A simple tick is enough", icon: "calendar" },
  { type: "stat", title: "42%", body: "Share of teams that track habits", icon: "bar-chart" },
  { type: "quote", title: "Progress is quiet", body: "Small steps add up over months", icon: "quote" },
  { type: "point", title: "Review every month", body: "Ten minutes is enough", icon: "refresh" },
  { type: "cta", title: "What habit are you starting?", body: "", icon: "message-circle" },
];

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(`${HOST}${url}`, {
    method,
    headers: { host: "127.0.0.1:3000", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function makePost(opts: { date: string; channel: string; format: string; id: string }): Promise<string> {
  const rel = `weeks/${WEEK}/days/${opts.date}/${opts.channel}.md`;
  await writeMarkdown(rel, {
    data: {
      id: opts.id,
      channel: opts.channel,
      status: "draft",
      topic: "AI at work",
      angle: "Small wins add up",
      format: opts.format,
      model: "nvidia/nemotron-3-ultra-550b-a55b:free",
      created: "2099-01-05T09:00:00+05:30",
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
    },
    body: "Small steps beat big plans. Here is why.",
  });
  return rel;
}

function deckFile(channel: string, day: string = DAY): string {
  return path.join(CONTENT_ROOT, "weeks", WEEK, "days", day, `${channel}-deck.json`);
}

beforeEach(() => {
  vi.mocked(readSwitches).mockReturnValue({ ...BASE_SWITCHES });
  vi.mocked(runJson).mockReset();
  vi.mocked(renderDeck).mockClear();
});

afterAll(() => {
  rmSync(CONTENT_ROOT, { recursive: true, force: true });
});

describe("POST /api/deck", () => {
  it("saves a valid 7-slide deck for a LinkedIn carousel post", async () => {
    const postPath = await makePost({ date: DAY, channel: "linkedin", format: "carousel", id: "post-1" });
    vi.mocked(runJson).mockResolvedValueOnce({
      data: { slides: SEVEN_SLIDES },
      text: "",
      model_used: "test-model",
    } as never);

    const res = await postDeck(jsonRequest("/api/deck", "POST", { post_path: postPath }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deck_path).toBe(`weeks/${WEEK}/days/${DAY}/linkedin-deck.json`);

    const saved = JSON.parse(readFileSync(deckFile("linkedin"), "utf8"));
    expect(DeckSchema.safeParse(saved).success).toBe(true);
    expect(saved.deck_id).toBe("post-1");
    expect(saved.size).toEqual({ w: 1080, h: 1350 });
    expect(saved.theme).toBe("clean-light");
    expect(saved.colors).toEqual({ bg: "#ffffff", text: "#111827", accent: "#2563eb", muted: "#6b7280" });
    expect(saved.slides).toHaveLength(7);
    expect(saved.icons).toBe(false);
  });

  it("refuses a Facebook post with no_deck_for_channel and makes no model call", async () => {
    const postPath = await makePost({ date: "2099-01-06", channel: "facebook", format: "text", id: "post-fb" });
    const res = await postDeck(jsonRequest("/api/deck", "POST", { post_path: postPath }));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("no_deck_for_channel");
    expect(runJson).not.toHaveBeenCalled();
  });

  it("returns deck_exists when a deck is already saved and replace is not set", async () => {
    const postPath = await makePost({ date: "2099-01-07", channel: "instagram", format: "carousel", id: "post-ig" });
    vi.mocked(runJson).mockResolvedValue({ data: { slides: SEVEN_SLIDES }, text: "", model_used: "m" } as never);
    expect((await postDeck(jsonRequest("/api/deck", "POST", { post_path: postPath }))).status).toBe(200);
    const again = await postDeck(jsonRequest("/api/deck", "POST", { post_path: postPath }));
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe("deck_exists");
  });

  it("returns invalid_deck when the model reply breaks the slide rules", async () => {
    const postPath = await makePost({ date: "2099-01-08", channel: "instagram", format: "carousel", id: "post-bad" });
    vi.mocked(runJson).mockRejectedValueOnce(
      new GatewayError("invalid_output", "The model's answer was not in the expected format, even after one retry."),
    );
    const res = await postDeck(jsonRequest("/api/deck", "POST", { post_path: postPath }));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("invalid_deck");
  });

  it("returns invalid_deck with the zod message when a switch value breaks the deck rules", async () => {
    const postPath = await makePost({ date: "2099-01-09", channel: "instagram", format: "carousel", id: "post-sw" });
    vi.mocked(readSwitches).mockReturnValue({
      ...BASE_SWITCHES,
      styling: { corner: "round-ish", card: "flat", padding: "medium" },
    });
    vi.mocked(runJson).mockResolvedValueOnce({ data: { slides: SEVEN_SLIDES }, text: "", model_used: "m" } as never);
    const res = await postDeck(jsonRequest("/api/deck", "POST", { post_path: postPath }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_deck");
    expect(body.error.message).toContain("styling.corner");
  });
});

describe("PATCH /api/deck", () => {
  it("changes colours and leaves every slide title and body unchanged", async () => {
    const postPath = await makePost({ date: "2099-01-10", channel: "linkedin", format: "carousel", id: "post-patch" });
    vi.mocked(runJson).mockResolvedValueOnce({ data: { slides: SEVEN_SLIDES }, text: "", model_used: "m" } as never);
    await postDeck(jsonRequest("/api/deck", "POST", { post_path: postPath }));
    const before = JSON.parse(readFileSync(deckFile("linkedin", "2099-01-10"), "utf8"));

    const res = await patchDeckRoute(
      jsonRequest("/api/deck", "PATCH", {
        deck_path: `weeks/${WEEK}/days/2099-01-10/linkedin-deck.json`,
        colors: { accent: "#ff5500" },
        styling: { corner: "very-rounded" },
      }),
    );
    expect(res.status).toBe(200);

    const after = JSON.parse(readFileSync(deckFile("linkedin", "2099-01-10"), "utf8"));
    expect(after.colors.accent).toBe("#ff5500");
    expect(after.styling.corner).toBe("very-rounded");
    expect(after.slides.map((s: { title: string; body: string }) => [s.title, s.body])).toEqual(
      before.slides.map((s: { title: string; body: string }) => [s.title, s.body]),
    );
    expect(DeckSchema.safeParse(after).success).toBe(true);
  });

  it("refuses a patch that tries to send slide text", async () => {
    const res = await patchDeckRoute(
      jsonRequest("/api/deck", "PATCH", {
        deck_path: `weeks/${WEEK}/days/2099-01-10/linkedin-deck.json`,
        slides: [],
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/render", () => {
  it("returns feature_off and never calls renderDeck when carousel rendering is off", async () => {
    vi.mocked(readSwitches).mockReturnValue({ ...BASE_SWITCHES, carousel_render: false });
    const res = await postRender(
      jsonRequest("/api/render", "POST", { deck_path: `weeks/${WEEK}/days/2099-01-10/linkedin-deck.json`, pdf: true }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("feature_off");
    expect(renderDeck).not.toHaveBeenCalled();
  });

  it("renders with a PDF for LinkedIn and writes alt.txt, one line per slide", async () => {
    const res = await postRender(
      jsonRequest("/api/render", "POST", { deck_path: `weeks/${WEEK}/days/2099-01-10/linkedin-deck.json`, pdf: true }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alt_path).toBe(`weeks/${WEEK}/days/2099-01-10/renders/linkedin/alt.txt`);
    expect(body.renders).toHaveLength(8);
    expect(renderDeck).toHaveBeenCalledTimes(1);
    expect(vi.mocked(renderDeck).mock.calls[0][2]).toMatchObject({ pdf: true, logo: undefined });

    const alt = readFileSync(path.join(CONTENT_ROOT, body.alt_path), "utf8").trim().split("\n");
    expect(alt).toHaveLength(7);
    expect(alt[0]).toContain("Why small wins matter");
  });

  it("does not render a PDF for an Instagram deck", async () => {
    const postPath = await makePost({ date: "2099-01-11", channel: "instagram", format: "carousel", id: "post-ig2" });
    vi.mocked(runJson).mockResolvedValueOnce({ data: { slides: SEVEN_SLIDES }, text: "", model_used: "m" } as never);
    await postDeck(jsonRequest("/api/deck", "POST", { post_path: postPath }));
    vi.mocked(renderDeck).mockClear();
    const res = await postRender(
      jsonRequest("/api/render", "POST", { deck_path: `weeks/${WEEK}/days/2099-01-11/instagram-deck.json`, pdf: true }),
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(renderDeck).mock.calls[0][2]).toMatchObject({ pdf: false });
  });

  it("refuses to render a post that is not set to carousel", async () => {
    const postPath = await makePost({ date: "2099-01-12", channel: "instagram", format: "text", id: "post-text" });
    vi.mocked(runJson).mockResolvedValueOnce({ data: { slides: SEVEN_SLIDES }, text: "", model_used: "m" } as never);
    await postDeck(jsonRequest("/api/deck", "POST", { post_path: postPath }));
    const res = await postRender(
      jsonRequest("/api/render", "POST", { deck_path: `weeks/${WEEK}/days/2099-01-12/instagram-deck.json` }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("not_carousel");
    expect(renderDeck).not.toHaveBeenCalled();
  });

  it("hides the logo slot without an error when no logo file exists", async () => {
    vi.mocked(readSwitches).mockReturnValue({
      ...BASE_SWITCHES,
      logo: { ...BASE_SWITCHES.logo, enabled: true },
    });
    const res = await postRender(
      jsonRequest("/api/render", "POST", { deck_path: `weeks/${WEEK}/days/2099-01-10/linkedin-deck.json` }),
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(renderDeck).mock.calls[0][2]).toMatchObject({ logo: undefined });
  });
});

describe("logo routes", () => {
  it("GET reports no logo when no file exists, without an error", async () => {
    const res = await getLogo(new Request(`${HOST}/api/logo`, { headers: { host: "127.0.0.1:3000" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ present: false });
  });

  it("POST rejects a JPG with the only-PNG-or-SVG message and saves nothing", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "logo.jpg", { type: "image/jpeg" }));
    const res = await postLogo(
      new Request(`${HOST}/api/logo`, { method: "POST", headers: { host: "127.0.0.1:3000" }, body: form }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.accepted).toBe(false);
    expect(body.reason).toBe("Only PNG or SVG logos are accepted.");
    expect(existsSync(path.join(CONTENT_ROOT, "assets", "logo.jpg"))).toBe(false);
    expect(existsSync(path.join(CONTENT_ROOT, "assets", "logo.png"))).toBe(false);
    expect(existsSync(path.join(CONTENT_ROOT, "assets", "logo.svg"))).toBe(false);
  });

  it("POST saves a valid SVG, then refuses to overwrite it without replace", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 5"></svg>';
    const send = (replace: boolean) => {
      const form = new FormData();
      form.append("file", new File([svg], "logo.svg", { type: "image/svg+xml" }));
      if (replace) form.append("replace", "true");
      return postLogo(new Request(`${HOST}/api/logo`, { method: "POST", headers: { host: "127.0.0.1:3000" }, body: form }));
    };
    const first = await send(false);
    expect(first.status).toBe(200);
    expect(existsSync(path.join(CONTENT_ROOT, "assets", "logo.svg"))).toBe(true);

    const second = await send(false);
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe("logo_exists");
  });
});

describe("GET /api/icons", () => {
  it("returns an empty list when public/icons is empty", async () => {
    const cwdRoot = path.join(CONTENT_ROOT, "..", `icons-root-${Math.random().toString(36).slice(2, 8)}`);
    const iconsDir = path.join(cwdRoot, "public", "icons");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(iconsDir, { recursive: true });
    const spy = vi.spyOn(process, "cwd").mockReturnValue(cwdRoot);
    try {
      const res = await getIcons(new Request(`${HOST}/api/icons?q=cpu`, { headers: { host: "127.0.0.1:3000" } }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ icons: [] });
    } finally {
      spy.mockRestore();
      rmSync(cwdRoot, { recursive: true, force: true });
    }
  });

  it("filters icon names by query", async () => {
    const dir = path.join(CONTENT_ROOT, "..", `icons-lib-${Math.random().toString(36).slice(2, 8)}`);
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "cpu.svg"), "<svg/>");
    writeFileSync(path.join(dir, "users.svg"), "<svg/>");
    writeFileSync(path.join(dir, "notes.txt"), "x");
    try {
      expect(await listIcons(dir, "CP")).toEqual(["cpu"]);
      expect(await listIcons(dir)).toEqual(["cpu", "users"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("buildAltText", () => {
  it("builds one line per slide from title and body", () => {
    const deck = DeckSchema.parse({
      deck_id: "x",
      channel: "linkedin",
      size: { w: 1080, h: 1350 },
      theme: "clean-light",
      colors: { bg: "#ffffff", text: "#111111", accent: "#2563eb", muted: "#666666" },
      styling: { corner: "rounded", card: "flat", padding: "medium" },
      slides: SEVEN_SLIDES,
    });
    const lines = buildAltText(deck).split("\n");
    expect(lines).toHaveLength(7);
    expect(lines[1]).toBe("Slide 2 of 7: Pick one habit. Choose a single habit Keep it under five minutes");
  });
});
