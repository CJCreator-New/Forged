import { promises as fs } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FEATURE_DEFAULTS } from "../../features/defaults";
import { readSwitches } from "../../config/switches";
import type { Switches } from "../../config/switches";
import { runWithFallback } from "../../gateway/fallback";
import type { ChatMessage } from "../../gateway/openrouter";
import { lintText } from "../../linter";
import { writeMarkdown } from "../../store/markdown";
import { resolveContentPath } from "../../store/paths";
import { hashBody, readPost } from "../../store/posts";
import { DailyError } from "../daily/errors";
import { adaptWeek } from "./adapt";
import { createWeekFromBrief } from "./create";
import { WeekError } from "./errors";
import { addDays, isoWeekIdForDate } from "./ids";
import { generatePillar, readPillarForWeek, savePillar } from "./pillar";
import { readWeekBrief } from "./brief";
import { viewWeek } from "./view";
import { mapWithConcurrency } from "./pool";

// Model and switch calls are faked. Files live in a random folder under content/, removed afterwards.
// The real content/voice.md and content/weeks are never read or written by these tests.

// Full-week runs write 21 posts and their raw copies, which takes longer than the default 5 seconds on Windows.
vi.setConfig({ testTimeout: 60_000 });

vi.mock("../../gateway/fallback", () => ({ runWithFallback: vi.fn() }));
vi.mock("../../config/switches", () => ({ readSwitches: vi.fn() }));

const BASE = `_week_test_${Math.random().toString(36).slice(2, 10)}`;
const WEEKS = `${BASE}/weeks`;
const VOICE = `${BASE}/voice.md`;
const WEEK_ID = "2026-W48"; // Monday 23 Nov 2026
const START = "2026-11-23";
const WEEK_PATH = `${WEEKS}/${WEEK_ID}`;

const BRIEF = {
  goal: "Show small teams how a checklist saves a week",
  audience: "Operations leads at small firms",
  key_points: ["Manual steps repeat", "A checklist removes the repeat"],
  cta: "Book a 20 minute call",
};

const PILLAR_TEXT = "A long pillar draft about the checklist. [SOURCE NEEDED] for any number.";
let pillarText = PILLAR_TEXT;
let adaptText = "Small teams lose a week to one manual step.\n\nWe moved that step into a checklist.\n\nWhich manual step costs your team the most time?";

let inFlight = 0;
let peak = 0;
let modelCalls = 0;

function answer(task: string, messages: ChatMessage[]): string {
  if (task === "pillar") return pillarText;
  if (task === "adapt") return adaptText;
  if (task === "humanise") return JSON.stringify({ rewrite: adaptText, changes: [] });
  throw new Error(`Unexpected task in test: ${task} ${messages.length}`);
}

beforeEach(async () => {
  inFlight = 0;
  peak = 0;
  modelCalls = 0;
  pillarText = PILLAR_TEXT;
  adaptText = "Small teams lose a week to one manual step.\n\nWe moved that step into a checklist.\n\nWhich manual step costs your team the most time?";
  vi.mocked(readSwitches).mockReturnValue({ ...FEATURE_DEFAULTS, humanise: true } as unknown as Switches);
  vi.mocked(runWithFallback).mockImplementation(async (task, messages) => {
    modelCalls++;
    inFlight++;
    peak = Math.max(peak, inFlight);
    try {
      // A short wait keeps several calls in flight at once, so the concurrency limit is really tested.
      await new Promise((resolve) => setTimeout(resolve, 2));
      return { text: answer(task, messages), model_used: `fake/${task}` };
    } finally {
      inFlight--;
    }
  });
  await fs.mkdir(resolveContentPath(BASE), { recursive: true });
  await fs.writeFile(resolveContentPath(VOICE), "Plain, direct, no hype.", "utf8");
});

afterEach(async () => {
  await fs.rm(resolveContentPath(BASE), { recursive: true, force: true });
  vi.clearAllMocks();
});

async function makeWeek(): Promise<void> {
  await createWeekFromBrief(
    { week_id: WEEK_ID, start_date: START, brief: BRIEF },
    { weeksBase: WEEKS },
  );
}

async function listPostPaths(): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    for (const channel of ["linkedin", "instagram", "facebook"]) {
      out.push(`${WEEK_PATH}/days/${addDays(START, i)}/${channel}.md`);
    }
  }
  return out;
}

async function bodyHashes(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const p of paths) out[p] = hashBody((await readPost(p)).body);
  return out;
}

describe("creating a week", () => {
  it("makes seven Day folders and brief.md", async () => {
    await makeWeek();
    const days = await fs.readdir(resolveContentPath(`${WEEK_PATH}/days`));
    expect(days.sort()).toEqual(Array.from({ length: 7 }, (_, i) => addDays(START, i)));
    await expect(fs.access(resolveContentPath(`${WEEK_PATH}/brief.md`))).resolves.toBeUndefined();
  });

  it("refuses a bad week id", async () => {
    await expect(
      createWeekFromBrief({ week_id: "2026-48", start_date: START, brief: BRIEF }, { weeksBase: WEEKS }),
    ).rejects.toMatchObject({ code: "bad_request" });
  });

  it("refuses a start date that is not a Monday or is in another week", async () => {
    await expect(
      createWeekFromBrief({ week_id: WEEK_ID, start_date: "2026-11-24", brief: BRIEF }, { weeksBase: WEEKS }),
    ).rejects.toMatchObject({ code: "bad_request" });
    await expect(
      createWeekFromBrief({ week_id: "2026-W49", start_date: START, brief: BRIEF }, { weeksBase: WEEKS }),
    ).rejects.toMatchObject({ code: "bad_request" });
  });

  it("refuses to overwrite an existing brief unless replace is true", async () => {
    await makeWeek();
    await expect(
      createWeekFromBrief({ week_id: WEEK_ID, start_date: START, brief: BRIEF }, { weeksBase: WEEKS }),
    ).rejects.toMatchObject({ code: "week_exists" });
    await createWeekFromBrief(
      { week_id: WEEK_ID, start_date: START, brief: { ...BRIEF, goal: "A new goal" }, replace: true },
      { weeksBase: WEEKS },
    );
  });

  it("maps ISO weeks correctly", () => {
    expect(isoWeekIdForDate(START)).toBe(WEEK_ID);
    expect(isoWeekIdForDate("2027-01-01")).toBe("2026-W53");
  });
});

describe("pillar", () => {
  it("writes pillar.md from the brief and voice", async () => {
    await makeWeek();
    const result = await generatePillar({ week_path: WEEK_PATH }, { voicePath: VOICE });
    expect(result.pillar_path).toBe(`${WEEK_PATH}/pillar.md`);
    expect(result.stale_posts).toEqual([]);
    const prompt = vi.mocked(runWithFallback).mock.calls[0][1][0].content;
    expect(prompt).toContain("Plain, direct, no hype.");
    expect(prompt).toContain("[SOURCE NEEDED]");
  });

  it("stops with voice_missing when the voice file is absent", async () => {
    await makeWeek();
    await expect(generatePillar({ week_path: WEEK_PATH }, { voicePath: `${BASE}/none.md` })).rejects.toBeInstanceOf(
      DailyError,
    );
    await expect(generatePillar({ week_path: WEEK_PATH }, { voicePath: `${BASE}/none.md` })).rejects.toMatchObject({
      code: "voice_missing",
    });
  });
});

describe("adaptation", () => {
  it("produces 21 posts that each pass lint", async () => {
    await makeWeek();
    await generatePillar({ week_path: WEEK_PATH }, { voicePath: VOICE });
    const result = await adaptWeek({ week_path: WEEK_PATH }, { voicePath: VOICE });

    expect(result.posts).toHaveLength(21);
    expect(result.posts.every((p) => p.status === "created")).toBe(true);
    for (const path of await listPostPaths()) {
      const post = await readPost(path);
      expect(post.frontmatter.status).toBe("draft");
      expect(post.frontmatter.stale).toBe(false);
      expect(post.frontmatter.format).toBe("text");
      const lint = lintText(post.body, {
        channel: post.frontmatter.channel,
        topic: BRIEF.goal,
        reviewRequired: post.frontmatter.review_required,
      });
      expect(lint.hard).toEqual([]);
    }
  });

  it("skips a user-edited post and leaves its body unchanged", async () => {
    await makeWeek();
    await generatePillar({ week_path: WEEK_PATH }, { voicePath: VOICE });
    await adaptWeek({ week_path: WEEK_PATH }, { voicePath: VOICE });

    const edited = `${WEEK_PATH}/days/${START}/linkedin.md`;
    const doc = await readPost(edited);
    await writeMarkdown(edited, { data: doc.frontmatter, body: "My own words, which I wrote by hand." });
    const editedHash = hashBody((await readPost(edited)).body);

    adaptText = "A completely different adapted body for the rerun.";
    const result = await adaptWeek({ week_path: WEEK_PATH }, { voicePath: VOICE });

    const item = result.posts.find((p) => p.path === edited);
    expect(item?.status).toBe("skipped_user_edited");
    expect(hashBody((await readPost(edited)).body)).toBe(editedHash);
    expect(result.posts.filter((p) => p.status === "replaced")).toHaveLength(20);
  });

  it("keeps a copy of the old body when it replaces a generated post", async () => {
    await makeWeek();
    await generatePillar({ week_path: WEEK_PATH }, { voicePath: VOICE });
    await adaptWeek({ week_path: WEEK_PATH }, { voicePath: VOICE });
    adaptText = "A second generated body for the same post.";
    await adaptWeek({ week_path: WEEK_PATH }, { voicePath: VOICE });
    const versions = await fs.readdir(resolveContentPath(`${WEEK_PATH}/days/${START}/versions`));
    expect(versions.length).toBeGreaterThan(0);
  });

  it("refuses to adapt before a pillar exists", async () => {
    await makeWeek();
    await expect(adaptWeek({ week_path: WEEK_PATH }, { voicePath: VOICE })).rejects.toMatchObject({
      code: "pillar_missing",
    });
  });
});

describe("editing the pillar", () => {
  it("marks every adapted post stale and changes no body", async () => {
    await makeWeek();
    await generatePillar({ week_path: WEEK_PATH }, { voicePath: VOICE });
    await adaptWeek({ week_path: WEEK_PATH }, { voicePath: VOICE });
    const paths = await listPostPaths();
    const before = await bodyHashes(paths);

    const result = await savePillar({ week_path: WEEK_PATH, body: "The user edited the pillar text." });

    expect(result.stale_posts.sort()).toEqual([...paths].sort());
    expect(await bodyHashes(paths)).toEqual(before);
    for (const path of paths) {
      expect((await readPost(path)).frontmatter.stale).toBe(true);
    }
  });
});

describe("concurrency", () => {
  it("never runs more than three model calls at once", async () => {
    await makeWeek();
    await generatePillar({ week_path: WEEK_PATH }, { voicePath: VOICE });
    peak = 0;
    await adaptWeek({ week_path: WEEK_PATH }, { voicePath: VOICE });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
    expect(modelCalls).toBeGreaterThanOrEqual(21);
  });

  it("the pool keeps input order and respects the limit", async () => {
    let running = 0;
    let top = 0;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 3, async (n) => {
      running++;
      top = Math.max(top, running);
      await new Promise((resolve) => setTimeout(resolve, 3));
      running--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60]);
    expect(top).toBe(3);
  });
});

describe("week view", () => {
  it("lists seven Days and 21 posts with their status", async () => {
    await makeWeek();
    await generatePillar({ week_path: WEEK_PATH }, { voicePath: VOICE });
    await adaptWeek({ week_path: WEEK_PATH }, { voicePath: VOICE });
    const view = await viewWeek(WEEK_ID, { weeksBase: WEEKS });
    expect(view.brief_present).toBe(true);
    expect(view.pillar_present).toBe(true);
    expect(view.days).toHaveLength(7);
    const posts = view.days.flatMap((d) => d.posts);
    expect(posts).toHaveLength(21);
    expect(posts.every((p) => p.status === "draft" && p.stale === false && p.lint_hard_count === 0)).toBe(true);
    expect(posts.every((p) => typeof p.review_required === "boolean")).toBe(true);
    expect(posts.every((p) => p.lint.hard === 0 && p.lint.soft >= 0)).toBe(true);
  });

  it("refuses an unknown week with not_found", async () => {
    await expect(viewWeek("2026-W02", { weeksBase: WEEKS })).rejects.toBeInstanceOf(WeekError);
    await expect(viewWeek("2026-W02", { weeksBase: WEEKS })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("Week page request and pillar read", () => {
  // The shape the Week page sends: "week", call_to_action, key_points as an array, empty link.
  const PAGE_BRIEF = {
    goal: BRIEF.goal,
    audience: BRIEF.audience,
    key_points: BRIEF.key_points,
    call_to_action: "Book a 20 minute call",
    link: "",
  };

  it("creates a week from the page request with no start date", async () => {
    const result = await createWeekFromBrief({ week: WEEK_ID, brief: PAGE_BRIEF }, { weeksBase: WEEKS });
    expect(result.week_path).toBe(WEEK_PATH);
    expect(result.days).toHaveLength(7);
    const saved = await readWeekBrief(WEEK_PATH);
    expect(saved.cta).toBe("Book a 20 minute call");
    expect(saved.key_points).toEqual(BRIEF.key_points);
    expect(saved.link).toBeUndefined();
  });

  it("returns week_exists for the page request unless replace is true", async () => {
    await createWeekFromBrief({ week: WEEK_ID, brief: PAGE_BRIEF }, { weeksBase: WEEKS });
    await expect(
      createWeekFromBrief({ week: WEEK_ID, brief: PAGE_BRIEF }, { weeksBase: WEEKS }),
    ).rejects.toMatchObject({ code: "week_exists" });
    await expect(
      createWeekFromBrief({ week: WEEK_ID, brief: PAGE_BRIEF, replace: true }, { weeksBase: WEEKS }),
    ).resolves.toMatchObject({ week_path: WEEK_PATH });
  });

  it("reads the pillar by week id, and says pillar_not_found before one exists", async () => {
    await createWeekFromBrief({ week: WEEK_ID, brief: PAGE_BRIEF }, { weeksBase: WEEKS });
    await expect(readPillarForWeek(WEEK_ID, { weeksBase: WEEKS })).rejects.toMatchObject({ code: "pillar_not_found" });
    await generatePillar({ week_path: WEEK_PATH }, { voicePath: VOICE });
    await expect(readPillarForWeek(WEEK_ID, { weeksBase: WEEKS })).resolves.toContain("A long pillar draft");
  });
});
