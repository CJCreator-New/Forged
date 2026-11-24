import { promises as fs } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FEATURE_DEFAULTS } from "../../features/defaults";
import { readSwitches } from "../../config/switches";
import { runWithFallback } from "../../gateway/fallback";
import type { ChatMessage } from "../../gateway/openrouter";
import { readMarkdown, writeMarkdown } from "../../store/markdown";
import { resolveContentPath } from "../../store/paths";
import { readPost } from "../../store/posts";
import { generateIdeas } from "./ideas";
import { pickAngle, isoWeekId } from "./day";
import { draftPost } from "./draft";
import { generateVariants } from "./variants";
import { selectVariant } from "./select-variant";
import { changeLength } from "./length";
import { DailyError } from "./errors";

// Model and switch calls are faked. Files are written inside a random folder under content/, removed afterwards.
// The real content/voice.md is never read or written by these tests.

vi.mock("../../gateway/fallback", () => ({ runWithFallback: vi.fn() }));
vi.mock("../../config/switches", () => ({ readSwitches: vi.fn() }));

const BASE = `_daily_test_${Math.random().toString(36).slice(2, 10)}`;
const VOICE = `${BASE}/voice.md`;
const IDEAS = `${BASE}/ideas`;
const WEEKS = `${BASE}/weeks`;
const NOW = new Date(2026, 10, 24, 9, 0, 0); // local Tuesday 24 Nov 2026, ISO week 2026-W48

const POST_TEXT =
  "Small teams often lose a week to one manual step.\n\nWe moved that step into a checklist and kept every fact the same.\n\nWhich manual step costs your team the most time?";
const HUMANISED = "Humanised text about the checklist.";
const EMOJI = "\u{1F680}";

let adaptText = POST_TEXT;
let humaniseText = JSON.stringify({ rewrite: HUMANISED, changes: ["Removed a stock word"] });

const ANGLES = Array.from({ length: 5 }, (_, i) => ({
  title: `Angle ${i + 1}`,
  hooks: [`Hook ${i + 1}a`, `Hook ${i + 1}b`, `Hook ${i + 1}c`],
  format: i === 0 ? "carousel" : "text",
  why_it_could_travel: "Teams ask about this every month.",
  source_urls: [],
}));

function fakeGateway(task: string, messages: ChatMessage[]) {
  if (task === "ideas") return { text: JSON.stringify(ANGLES), model_used: "fake/ideas" };
  if (task === "adapt") return { text: adaptText, model_used: "fake/adapt" };
  if (task === "humanise") return { text: humaniseText, model_used: "fake/humanise" };
  if (task === "variants") {
    const n = Number(/Write (\d) variants/.exec(messages[0].content)?.[1] ?? "2");
    const variants = Array.from({ length: n }, (_, i) => ({
      variant_index: i + 1,
      hook: `Variant hook ${i + 1}`,
      body: `Variant body ${i + 1} about the checklist.`,
    }));
    return { text: JSON.stringify(variants), model_used: "fake/variants" };
  }
  throw new Error(`Unexpected task in test: ${task}`);
}

const gateway = vi.mocked(runWithFallback);
const switchesMock = vi.mocked(readSwitches);

function humaniseCalls(): number {
  return gateway.mock.calls.filter(([task]) => task === "humanise").length;
}

async function writeVoice(): Promise<void> {
  const file = resolveContentPath(VOICE);
  await fs.mkdir(resolveContentPath(BASE), { recursive: true });
  await fs.writeFile(file, "Plain, direct, no hype. Short sentences.\n", "utf8");
}

async function listDir(rel: string): Promise<string[]> {
  try {
    return await fs.readdir(resolveContentPath(rel));
  } catch {
    return [];
  }
}

async function makeDay() {
  const idea = await generateIdeas({ topic: "AI at work", trend_mode: false }, { voicePath: VOICE, ideasDir: IDEAS, now: NOW });
  const picked = await pickAngle({ idea_file: idea.idea_file, angle_index: 0 }, { weeksBase: WEEKS, now: NOW });
  return { idea, picked };
}

beforeEach(async () => {
  adaptText = POST_TEXT;
  humaniseText = JSON.stringify({ rewrite: HUMANISED, changes: ["Removed a stock word"] });
  gateway.mockReset();
  gateway.mockImplementation(async (task, messages) => fakeGateway(task, messages as ChatMessage[]));
  switchesMock.mockReset();
  switchesMock.mockReturnValue({ ...FEATURE_DEFAULTS, styling: { ...FEATURE_DEFAULTS.styling }, logo: { ...FEATURE_DEFAULTS.logo }, performance_loop: { ...FEATURE_DEFAULTS.performance_loop } });
  await writeVoice();
});

afterEach(async () => {
  await fs.rm(resolveContentPath(BASE), { recursive: true, force: true });
});

describe("daily pipeline", () => {
  it("one topic gives 5 angles and 3 linted posts", async () => {
    const { idea, picked } = await makeDay();
    expect(idea.angles).toHaveLength(5);
    expect(picked.posts.map((p) => p.channel)).toEqual(["linkedin", "instagram", "facebook"]);

    for (const p of picked.posts) {
      const result = await draftPost(
        { day_path: picked.day_path, channel: p.channel, length: "medium", style: "direct", humanise: "inherit" },
        { voicePath: VOICE, now: NOW },
      );
      expect(result.lint.hard).toEqual([]);
      expect(Array.isArray(result.lint.soft)).toBe(true);
      const saved = await readPost(result.post_path);
      expect(saved.frontmatter.lint).toEqual(expect.objectContaining({ hard: expect.any(Array), soft: expect.any(Array) }));
    }
  });

  it("humanise off makes zero humanise calls, and the linter still runs", async () => {
    switchesMock.mockReturnValue({ ...FEATURE_DEFAULTS, humanise: false, styling: { ...FEATURE_DEFAULTS.styling }, logo: { ...FEATURE_DEFAULTS.logo }, performance_loop: { ...FEATURE_DEFAULTS.performance_loop } });
    adaptText = `${POST_TEXT} ${EMOJI}`;
    const { picked } = await makeDay();

    const result = await draftPost(
      { day_path: picked.day_path, channel: "linkedin", length: "medium", style: "direct", humanise: "inherit" },
      { voicePath: VOICE, now: NOW },
    );

    expect(humaniseCalls()).toBe(0);
    expect(result.humanised).toBe(false);
    expect(result.lint.hard.some((m) => m.startsWith("H1"))).toBe(true);
  });

  it("humanise on saves both the humanised body and the raw copy", async () => {
    adaptText = "Raw draft about the checklist.";
    const { picked } = await makeDay();

    const result = await draftPost(
      { day_path: picked.day_path, channel: "linkedin", length: "medium", style: "direct", humanise: "on" },
      { voicePath: VOICE, now: NOW },
    );

    expect(humaniseCalls()).toBe(1);
    const post = await readMarkdown(result.post_path);
    expect(post.body.trim()).toBe(HUMANISED);
    const raw = await fs.readFile(resolveContentPath(`${picked.day_path}/linkedin.raw.md`), "utf8");
    expect(raw.trim()).toBe("Raw draft about the checklist.");
  });

  it("trend on with a failing fetch returns trend_failed and writes no ideas file", async () => {
    const failing = async () => {
      throw new Error("network down");
    };
    await expect(
      generateIdeas({ topic: "AI at work", trend_mode: true }, { voicePath: VOICE, ideasDir: IDEAS, now: NOW, fetchTrend: failing }),
    ).rejects.toMatchObject({ code: "trend_failed" });
    expect(await listDir(IDEAS)).toEqual([]);
    expect(gateway).not.toHaveBeenCalled();
  });

  it("trend failure keeps the trend module's plain reason", async () => {
    const capped = async () => {
      throw new Error("The monthly cap of 900 trend searches was reached.");
    };
    await expect(
      generateIdeas({ topic: "AI at work", trend_mode: true }, { voicePath: VOICE, ideasDir: IDEAS, now: NOW, fetchTrend: capped }),
    ).rejects.toThrow(/monthly cap of 900/);
  });

  it("missing voice.md returns voice_missing and makes no model call", async () => {
    await expect(
      generateIdeas({ topic: "AI at work", trend_mode: false }, { voicePath: `${BASE}/no-voice.md`, ideasDir: IDEAS, now: NOW }),
    ).rejects.toMatchObject({ code: "voice_missing" });
    expect(gateway).not.toHaveBeenCalled();
  });

  it("a post never has a channel key named platform", async () => {
    const { picked } = await makeDay();
    const result = await draftPost(
      { day_path: picked.day_path, channel: "instagram", length: "short", style: "direct", humanise: "off" },
      { voicePath: VOICE, now: NOW },
    );
    const doc = await readMarkdown(result.post_path);
    expect(doc.data).not.toHaveProperty("platform");
    expect(doc.data.channel).toBe("instagram");
  });

  it("variant count is 2 by default and each variant has a lint result", async () => {
    switchesMock.mockReturnValue({ ...FEATURE_DEFAULTS, humanise: false, styling: { ...FEATURE_DEFAULTS.styling }, logo: { ...FEATURE_DEFAULTS.logo }, performance_loop: { ...FEATURE_DEFAULTS.performance_loop } });
    const { picked } = await makeDay();
    const draft = await draftPost(
      { day_path: picked.day_path, channel: "linkedin", length: "medium", style: "direct", humanise: "inherit" },
      { voicePath: VOICE, now: NOW },
    );

    const result = await generateVariants({ post_path: draft.post_path }, { voicePath: VOICE, now: NOW });

    expect(result.variants).toHaveLength(2);
    for (const v of result.variants) {
      expect(v.lint).toEqual(expect.objectContaining({ hard: expect.any(Array), soft: expect.any(Array) }));
      expect(await listDir(`${picked.day_path}/variants`)).toContain(`linkedin-v${v.variant_index}.md`);
    }
  });

  it("select-variant refuses a user-edited post and changes nothing", async () => {
    const { picked } = await makeDay();
    const draft = await draftPost(
      { day_path: picked.day_path, channel: "linkedin", length: "medium", style: "direct", humanise: "off" },
      { voicePath: VOICE, now: NOW },
    );
    await generateVariants({ post_path: draft.post_path, count: 2 }, { voicePath: VOICE, now: NOW });
    const doc = await readMarkdown(draft.post_path);
    await writeMarkdown(draft.post_path, { data: doc.data, body: "Hand-written text by the user.\n" });

    await expect(selectVariant({ post_path: draft.post_path, variant_index: 1 })).rejects.toMatchObject({ code: "user_edited" });
    const after = await readMarkdown(draft.post_path);
    expect(after.body.trim()).toBe("Hand-written text by the user.");
  });

  it("change length keeps the previous body as a version", async () => {
    const { picked } = await makeDay();
    const draft = await draftPost(
      { day_path: picked.day_path, channel: "linkedin", length: "medium", style: "direct", humanise: "off" },
      { voicePath: VOICE, now: NOW },
    );
    adaptText = "A shorter LinkedIn post about the checklist.\n\nOne step, one fact.";

    const result = await changeLength({ post_path: draft.post_path, length: "short" }, { voicePath: VOICE });

    expect(result.previous_path).toContain("versions");
    expect((await readPost(draft.post_path)).frontmatter.length).toBe("short");
    expect(await listDir(`${picked.day_path}/versions`)).toHaveLength(1);
  });

  it("isoWeekId gives the ISO week for the test date", () => {
    expect(isoWeekId(NOW)).toBe("2026-W48");
  });

  it("draft refuses a second post for the same channel and day", async () => {
    const { picked } = await makeDay();
    const input = { day_path: picked.day_path, channel: "facebook" as const, length: "medium" as const, style: "direct", humanise: "off" as const };
    await draftPost(input, { voicePath: VOICE, now: NOW });
    await expect(draftPost(input, { voicePath: VOICE, now: NOW })).rejects.toBeInstanceOf(DailyError);
    await expect(draftPost(input, { voicePath: VOICE, now: NOW })).rejects.toMatchObject({ code: "post_exists" });
  });
});
