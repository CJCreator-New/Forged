import { existsSync, promises as fs } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flagState = vi.hoisted(() => ({
  trend: false,
  humanise: true,
  variants: 2,
  length: "medium",
  soft: true,
  carousel: false,
}));

vi.mock("../gateway", () => ({ callModel: vi.fn(), callJson: vi.fn() }));
vi.mock("../features/flags", () => ({
  trendMode: () => flagState.trend,
  humanise: () => flagState.humanise,
  variants: () => flagState.variants,
  length: () => flagState.length,
  linterSoftWarnings: () => flagState.soft,
  carouselRender: () => flagState.carousel,
}));

import { callJson, callModel } from "../gateway";
import { readMarkdown } from "../store/markdown";
import { resolveContentPath } from "../store/paths";
import { draftDaily, generateAngles } from "./index";

const mCallModel = vi.mocked(callModel);
const mCallJson = vi.mocked(callJson);

// A date no real data uses. The store tests use days 01 to 28, so day 31 never collides.
const DATE = "2099-12-31";
const TOPIC = "Pipeline test topic";
const TASKS = () => [...mCallModel.mock.calls, ...mCallJson.mock.calls].map((c) => c[0] as string);

const FIRST = "Ops teams spend 42 hours a week on handoffs.";
const SENT = "Ops teams spend 42 hours a week on handoffs and nobody counts them. ";
function body(platform: string, extra = ""): string {
  if (platform === "linkedin") return `${FIRST}\n\n${SENT.repeat(14)}${extra}`.trim();
  if (platform === "instagram") return `${FIRST}\n${SENT.repeat(4)}#ops #ai #work${extra}`.trim();
  return `${FIRST}\n\n${SENT.repeat(6)}${extra}`.trim();
}

const platformOf = (prompt: { user: string }) => /PLATFORM: (\w+)/.exec(prompt.user)![1];
const model = (text: string) => ({ text, model: "test/adapt", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, attempts: ["test/adapt"] });

type Over = {
  adapt?: (platform: string) => string;
  humanise?: (raw: string) => { rewrite: string; changes: string[] };
  variants?: (selected: string, n: number) => { variant_index: number; hook: string; body: string }[];
};

function setup(over: Over = {}) {
  mCallModel.mockImplementation(async (task, prompt) => {
    if (task !== "adapt") throw new Error(`unexpected callModel task ${task}`);
    const p = platformOf(prompt);
    return model(over.adapt ? over.adapt(p) : body(p));
  });
  mCallJson.mockImplementation((async (task: string, prompt: { user: string }) => {
    if (task === "humanise") {
      const raw = /<draft>\n([\s\S]*?)\n<\/draft>/.exec(prompt.user)![1];
      return over.humanise ? over.humanise(raw) : { rewrite: raw.replace("nobody counts them", "no one counts them"), changes: ["x"] };
    }
    if (task === "variants") {
      const sel = /<selected_post>\n([\s\S]*?)\n<\/selected_post>/.exec(prompt.user)![1];
      const n = Number(/Write (\d) variants/.exec(prompt.user)![1]);
      return over.variants
        ? over.variants(sel, n)
        : Array.from({ length: n }, (_, i) => ({ variant_index: i + 1, hook: `Hook ${i + 1}`, body: sel.replace(FIRST, `Hook ${i + 1}. ${FIRST}`) }));
    }
    if (task === "ideas") {
      return Array.from({ length: 5 }, (_, i) => ({
        title: `Angle ${i}`,
        hooks: ["a", "b", "c"],
        format: i === 0 ? "carousel" : "text",
        why_it_could_travel: "because",
        source_urls: ["https://invented.example"],
      }));
    }
    throw new Error(`unexpected callJson task ${task}`);
  }) as never);
}

async function cleanup() {
  await fs.rm(resolveContentPath(`daily/${DATE}`), { recursive: true, force: true });
  const dir = resolveContentPath("ideas");
  for (const f of await fs.readdir(dir)) {
    if (f.startsWith(`${DATE}-`)) await fs.rm(`${dir}/${f}`, { force: true });
  }
}

const draft = (over: Record<string, unknown> = {}) =>
  draftDaily({ date: DATE, topic: TOPIC, angle: "Ops teams automate the wrong step", voiceFile: `daily/${DATE}/voice-absent.md`, ...over });

beforeEach(() => {
  Object.assign(flagState, { trend: false, humanise: true, variants: 2, length: "medium", soft: true, carousel: false });
  mCallModel.mockReset();
  mCallJson.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(async () => {
  vi.restoreAllMocks();
  await cleanup();
});

describe("feature switches make no calls when off", () => {
  it("trend on throws before any call", async () => {
    setup();
    flagState.trend = true;
    await expect(generateAngles({ date: DATE, topic: TOPIC })).rejects.toThrow("Trend mode is not built yet in M1");
    expect(mCallModel).not.toHaveBeenCalled();
    expect(mCallJson).not.toHaveBeenCalled();
  });

  it("humanise off: no humanise call, raw not saved", async () => {
    setup();
    flagState.humanise = false;
    const { results } = await draft();
    expect(TASKS()).not.toContain("humanise");
    expect(results.every((r) => !r.humanised)).toBe(true);
    expect(existsSync(resolveContentPath(`daily/${DATE}/raw/linkedin.md`))).toBe(false);
  });

  it("variants off: no variants call, nothing in variants/", async () => {
    setup();
    flagState.variants = 0;
    const { results } = await draft();
    expect(TASKS()).not.toContain("variants");
    expect(results.every((r) => r.variants === 0)).toBe(true);
    expect(existsSync(resolveContentPath(`daily/${DATE}/variants`))).toBe(false);
  });

  it("carousel render on never calls slides, and a carousel angle is rejected before any call", async () => {
    setup();
    flagState.carousel = true;
    await draft();
    expect(TASKS()).not.toContain("slides");
    expect(TASKS()).not.toContain("pillar");
    mCallModel.mockClear();
    mCallJson.mockClear();
    await expect(draft({ format: "carousel" })).rejects.toThrow(/Carousel/);
    expect(TASKS()).toEqual([]);
  });

  it("soft warnings off: no soft issues, still no extra calls", async () => {
    setup();
    flagState.soft = false;
    const { results } = await draft();
    expect(results.every((r) => r.soft.length === 0)).toBe(true);
    expect(TASKS().filter((t) => t === "adapt")).toHaveLength(3);
  });
});

describe("generateAngles", () => {
  it("saves ideas, drops invented source urls, keeps carousel in list but not draftable", async () => {
    setup();
    const r = await generateAngles({ date: DATE, topic: TOPIC });
    expect(r.path).toBe(`ideas/${DATE}-pipeline-test-topic.md`);
    expect(r.angles).toHaveLength(5);
    expect(r.angles.every((a) => a.source_urls.length === 0)).toBe(true);
    expect(r.draftable).toHaveLength(4);
    expect(r.draftable.every((a) => a.format === "text")).toBe(true);
    expect(existsSync(resolveContentPath(r.path))).toBe(true);
  });

  it("stops if the ideas file already exists", async () => {
    setup();
    await generateAngles({ date: DATE, topic: TOPIC });
    mCallJson.mockClear();
    await expect(generateAngles({ date: DATE, topic: TOPIC })).rejects.toThrow(/already exists/);
    expect(mCallJson).not.toHaveBeenCalled();
  });
});

describe("draftDaily", () => {
  it("saves three platform posts and both variants for each", async () => {
    setup();
    const { results } = await draft();
    expect(results.map((r) => r.platform)).toEqual(["linkedin", "instagram", "facebook"]);
    for (const r of results) {
      expect(r.path).toBe(`daily/${DATE}/${r.platform}.md`);
      expect(r.passed).toBe(true);
      expect(r.variants).toBe(2);
      expect(r.humanised).toBe(true);
      expect(r.notes).toContain("voice_missing");
      expect(existsSync(resolveContentPath(`daily/${DATE}/variants/${r.platform}-v1.md`))).toBe(true);
      expect(existsSync(resolveContentPath(`daily/${DATE}/variants/${r.platform}-v2.md`))).toBe(true);
    }
  });

  it("humanise on: raw and rewritten are both saved and differ", async () => {
    setup();
    flagState.variants = 0;
    await draft({ platforms: ["linkedin"] });
    const post = await readMarkdown(`daily/${DATE}/linkedin.md`);
    const raw = await readMarkdown(`daily/${DATE}/raw/linkedin.md`);
    expect(post.data.humanised).toBe(true);
    expect(post.body).toContain("no one counts them");
    expect(raw.body).toContain("nobody counts them");
  });

  it("humanise that drops a number is discarded", async () => {
    setup({ humanise: (raw) => ({ rewrite: raw.replaceAll("42", "many"), changes: ["x"] }) });
    flagState.variants = 0;
    const { results } = await draft({ platforms: ["linkedin"] });
    expect(results[0].humanised).toBe(false);
    expect(results[0].notes).toContain("humanise_failed");
    const post = await readMarkdown(`daily/${DATE}/linkedin.md`);
    expect(post.body).toContain("42");
    expect(post.body).toContain("nobody counts them");
    expect(existsSync(resolveContentPath(`daily/${DATE}/raw/linkedin.md`))).toBe(false);
  });

  it.each([2, 3])("variants=%i saves that many, linted separately, selected only on the body", async (n) => {
    setup();
    flagState.variants = n;
    const { results } = await draft({ platforms: ["linkedin"] });
    expect(results[0].variants).toBe(n);
    const sel: boolean[] = [];
    for (let i = 1; i <= n; i++) {
      const v = await readMarkdown(`daily/${DATE}/variants/linkedin-v${i}.md`);
      expect(v.data.lint).toEqual({ hard: [], soft: expect.any(Array) });
      sel.push(v.data.selected as boolean);
    }
    expect(sel).toEqual([true, ...Array(n - 1).fill(false)]);
    expect(existsSync(resolveContentPath(`daily/${DATE}/variants/linkedin-v${n + 1}.md`))).toBe(false);
  });

  it("a hard-failing variant never becomes the body", async () => {
    setup({
      variants: (sel) => [
        { variant_index: 1, hook: "h1", body: sel.replace(FIRST, `Bad — hook. ${FIRST}`) },
        { variant_index: 2, hook: "h2", body: sel.replace(FIRST, `Good hook. ${FIRST}`) },
      ],
    });
    const { results } = await draft({ platforms: ["linkedin"] });
    const post = await readMarkdown(`daily/${DATE}/linkedin.md`);
    expect(post.body).toContain("Good hook.");
    expect(post.body).not.toContain("—");
    expect(results[0].passed).toBe(true);
    const v1 = await readMarkdown(`daily/${DATE}/variants/linkedin-v1.md`);
    const v2 = await readMarkdown(`daily/${DATE}/variants/linkedin-v2.md`);
    expect(v1.data.selected).toBe(false);
    expect((v1.data.lint as { hard: string[] }).hard.join(" ")).toContain("H2");
    expect(v2.data.selected).toBe(true);
  });

  it("emoji or em dash in the draft records a hard failure and no export", async () => {
    setup({ adapt: (p) => body(p, " \u{1F680}"), humanise: (raw) => ({ rewrite: raw, changes: [] }) });
    flagState.variants = 0;
    const { results } = await draft({ platforms: ["linkedin"] });
    expect(results[0].passed).toBe(false);
    expect(results[0].hard.map((i) => i.id)).toContain("H1");
    const post = await readMarkdown(`daily/${DATE}/linkedin.md`);
    expect(post.data.status).toBe("draft");
    expect((post.data.lint as { hard: string[] }).hard.length).toBeGreaterThan(0);

    await cleanup();
    setup({ adapt: (p) => body(p, " a — b"), humanise: (raw) => ({ rewrite: raw, changes: [] }) });
    const r2 = await draft({ platforms: ["facebook"] });
    expect(r2.results[0].hard.map((i) => i.id)).toContain("H2");
  });

  it("a length miss retries once, then records length_miss", async () => {
    setup({ adapt: () => "Too short 42." });
    flagState.humanise = false;
    flagState.variants = 0;
    const { results } = await draft({ platforms: ["linkedin"] });
    expect(TASKS().filter((t) => t === "adapt")).toHaveLength(2);
    expect(results[0].notes).toContain("length_miss");
    expect(results[0].passed).toBe(false);
  });

  it("missing voice.md: file not created, note recorded, placeholder used", async () => {
    setup();
    const voice = `daily/${DATE}/voice-absent.md`;
    const { results } = await draft({ platforms: ["linkedin"], voiceFile: voice });
    expect(existsSync(resolveContentPath(voice))).toBe(false);
    expect(results[0].notes).toContain("voice_missing");
    const sys = mCallModel.mock.calls[0][1].system as string;
    expect(sys).toContain("No voice profile yet.");
    expect(sys).toContain("Do not use emojis, em dashes, or engagement-bait phrases. Do not invent facts, numbers, or sources.");
  });

  it("present voice file is used and no voice_missing note", async () => {
    setup();
    const voice = `daily/${DATE}/voice-present.md`;
    await fs.mkdir(resolveContentPath(`daily/${DATE}`), { recursive: true });
    await fs.writeFile(resolveContentPath(voice), "# Voice\nMARKER-VOICE-TEXT", "utf8");
    const { results } = await draft({ platforms: ["linkedin"], voiceFile: voice });
    expect(results[0].notes).not.toContain("voice_missing");
    expect(mCallModel.mock.calls[0][1].system).toContain("MARKER-VOICE-TEXT");
  });

  it("never overwrites: stops before any call if a target exists", async () => {
    setup();
    await draft({ platforms: ["linkedin"] });
    mCallModel.mockClear();
    mCallJson.mockClear();
    await expect(draft({ platforms: ["linkedin"] })).rejects.toThrow(/already exists/);
    expect(TASKS()).toEqual([]);
  });

  it("puts topic and angle inside marked data blocks", async () => {
    setup();
    await draft({ platforms: ["facebook"] });
    const user = mCallModel.mock.calls[0][1].user;
    expect(user).toContain("<topic>\nPipeline test topic\n</topic>");
    expect(user).toContain("<angle>\nOps teams automate the wrong step\n</angle>");
  });
});
