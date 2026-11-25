// Daily flow: angles, then drafts for each platform (humanise, variants, lint).
// Server only. Model calls go through ../gateway. Writes go through the store helpers.
import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { callJson, callModel } from "../gateway";
import { humanise, length as lengthFlag, linterSoftWarnings, trendMode, variants as variantsFlag } from "../features/flags";
import { lintPost, type Issue } from "../linter";
import { PLATFORMS, ideaPath, postPath, rawPath, slugify, variantPath } from "../store/daily";
import { readMarkdown, writeMarkdown } from "../store/markdown";
import { resolveContentPath } from "../store/paths";
import { saveIdeas } from "../store/ideas";
import { savePost, saveVariant, type PostLength } from "../store/posts";
import {
  NO_VOICE,
  adaptSystem,
  adaptUser,
  humaniseUser,
  ideasUser,
  inRange,
  measure,
  variantsUser,
  BODY_RANGES,
  UNIT,
  type Platform,
} from "./prompts";

export type { Platform } from "./prompts";

// ---------- shared helpers ----------

async function exists(rel: string): Promise<boolean> {
  try {
    await fs.access(resolveContentPath(rel));
    return true;
  } catch {
    return false;
  }
}

async function assertNoneExist(rels: string[]): Promise<void> {
  for (const rel of rels) {
    if (await exists(rel)) {
      throw new Error(`Target already exists, stopping without writing: content/${rel}`);
    }
  }
}

function stripFences(text: string): string {
  const t = text.trim();
  const m = t.match(/^```[a-z]*\s*\n?([\s\S]*?)\n?```$/i);
  return (m ? m[1] : t).trim();
}

// Numbers as plain tokens, so "1,200" and "1200" compare equal.
function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, "").replace(/\.$/, ""));
}

/** True when every number in `raw` still appears in `next`. */
function keepsNumbers(raw: string, next: string): boolean {
  const have = new Set(numbersIn(next));
  return numbersIn(raw).every((n) => have.has(n));
}

function issueText(i: Issue): string {
  return `${i.id}: ${i.message}`;
}

function modelLog(task: string, model: string): void {
  console.log(`[pipeline] task=${task} model=${model} status=ok`);
}

// callJson does not return which model answered, so ideas files record the configured primary.
function configuredModel(task: string): string {
  try {
    const cfg = JSON.parse(readFileSync(path.join(process.cwd(), "config", "models.json"), "utf8")) as {
      tasks?: Record<string, { primary?: string }>;
    };
    return cfg.tasks?.[task]?.primary ?? "unknown";
  } catch {
    return "unknown";
  }
}

// ---------- 1. generateAngles ----------

const AngleSchema = z.object({
  title: z.string().min(1),
  hooks: z.array(z.string()).length(3),
  format: z.enum(["text", "carousel"]),
  why_it_could_travel: z.string(),
  source_urls: z.array(z.string()),
});
const AnglesSchema = z.array(AngleSchema).min(5).max(10);

export type Angle = z.infer<typeof AngleSchema>;

export interface GenerateAnglesResult {
  /** Path relative to content/. */
  path: string;
  /** Every angle the model returned. */
  angles: Angle[];
  /** Angles that can be drafted in M1 (text format only). Carousel angles stay in `angles`. */
  draftable: Angle[];
}

/**
 * Topic in, 5 to 10 angles out. Saved to content/ideas/<date>-<slug>.md.
 * Throws before any call if trend mode is on (not built in M1) or if the target file exists.
 */
export async function generateAngles(input: { date: string; topic: string }): Promise<GenerateAnglesResult> {
  if (trendMode()) throw new Error("Trend mode is not built yet in M1");
  const topic = input.topic;
  if (typeof topic !== "string" || topic.trim() === "") throw new Error("Topic must be a non-empty string.");
  const target = ideaPath(input.date, slugify(topic));
  await assertNoneExist([target]);

  const parsed = await callJson("ideas", { user: ideasUser(topic) }, AnglesSchema);
  // No trend context in M1, so any source URL the model returns is invented. Drop them.
  const angles = parsed.map((a) => ({ ...a, source_urls: [] as string[] }));
  const savedPath = await saveIdeas({ date: input.date, topic, model: configuredModel("ideas"), angles });
  return { path: savedPath, angles, draftable: angles.filter((a) => a.format !== "carousel") };
}

// ---------- 2. draftDaily ----------

const HumaniseSchema = z.object({ rewrite: z.string().min(1), changes: z.array(z.string()) });
const VariantsSchema = z.array(
  z.object({ variant_index: z.number().int(), hook: z.string(), body: z.string().min(1) }),
);

export interface PlatformResult {
  platform: Platform;
  /** Path of the selected post relative to content/. Empty string if the platform failed. */
  path: string;
  passed: boolean;
  hard: Issue[];
  soft: Issue[];
  /** Number of variants saved. */
  variants: number;
  humanised: boolean;
  model: string;
  attempts: string[];
  /** Flags such as voice_missing, humanise_failed, length_miss, variant_dropped, error: ... */
  notes: string[];
}

export interface DraftDailyResult {
  results: PlatformResult[];
}

async function readVoice(voiceFile: string): Promise<string | null> {
  try {
    const text = await fs.readFile(resolveContentPath(voiceFile), "utf8");
    return text.trim() === "" ? null : text;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

function lintBody(platform: Platform, body: string, length: PostLength, hook?: string) {
  return lintPost({
    platform,
    body,
    hook,
    length,
    reviewRequired: false,
    softWarnings: linterSoftWarnings(),
  });
}

// Adds lint results and notes to a file this run just wrote (the store has no lint field yet).
async function stampLint(
  rel: string,
  hard: Issue[],
  soft: Issue[],
  attempts: string[],
  notes: string[],
): Promise<void> {
  const doc = await readMarkdown(rel);
  doc.data.status = "draft";
  doc.data.lint = { hard: hard.map(issueText), soft: soft.map(issueText) };
  if (attempts.length > 1) doc.data.model_attempts = attempts;
  if (notes.length > 0) doc.data.notes = notes;
  await writeMarkdown(rel, doc);
}

async function draftOne(
  platform: Platform,
  p: { date: string; topic: string; angle: string; voice: string; voiceMissing: boolean },
): Promise<PlatformResult> {
  const length = lengthFlag() as PostLength;
  const notes: string[] = p.voiceMissing ? ["voice_missing"] : [];
  const system = adaptSystem(platform, length, p.voice);

  // b. First generation, with at most one retry if the length misses its range.
  let gen = await callModel("adapt", { system, user: adaptUser(platform, length, p.topic, p.angle) });
  modelLog("adapt", gen.model);
  let raw = stripFences(gen.text);
  const attempts = [...gen.attempts];
  if (!inRange(platform, length, raw)) {
    const [min, max] = BODY_RANGES[platform][length];
    const note = `Your previous attempt was ${measure(platform, raw)} ${UNIT[platform]}. It must be ${min} to ${max} ${UNIT[platform]}.`;
    gen = await callModel("adapt", { system, user: adaptUser(platform, length, p.topic, p.angle, note) });
    modelLog("adapt", gen.model);
    raw = stripFences(gen.text);
    attempts.push(...gen.attempts);
    if (!inRange(platform, length, raw)) notes.push("length_miss");
  }
  const model = gen.model;

  // c. Humanise, only when the switch is on.
  let body = raw;
  let humanised = false;
  if (humanise()) {
    try {
      const h = await callJson("humanise", { user: humaniseUser(raw) }, HumaniseSchema);
      const rewrite = stripFences(h.rewrite);
      if (keepsNumbers(raw, rewrite)) {
        body = rewrite;
        humanised = true;
      } else {
        notes.push("humanise_failed");
      }
    } catch {
      notes.push("humanise_failed");
    }
  }

  // d. Variants, only when the switch is 2 or 3.
  const n = variantsFlag();
  const candidates: { hook: string; body: string; lint: ReturnType<typeof lintBody> }[] = [];
  if (n === 2 || n === 3) {
    try {
      const list = await callJson("variants", { user: variantsUser(body, n) }, VariantsSchema);
      const sorted = [...list].sort((a, b) => a.variant_index - b.variant_index).slice(0, n);
      for (const v of sorted) {
        const vb = stripFences(v.body);
        if (!keepsNumbers(body, vb)) {
          notes.push("variant_dropped");
          continue;
        }
        candidates.push({ hook: v.hook, body: vb, lint: lintBody(platform, vb, length, v.hook) });
      }
    } catch {
      notes.push("variants_failed");
    }
  }

  // The first variant that passes lint becomes the body. If none passes, the draft stays the body.
  const chosen = candidates.findIndex((c) => c.lint.passed);
  if (chosen >= 0) body = candidates[chosen].body;

  // e. Lint the final body.
  const finalLint =
    chosen >= 0 ? candidates[chosen].lint : lintBody(platform, body, length);

  // f. Save. Variants first, then the selected post.
  const base = { date: p.date, platform, topic: p.topic, angle: p.angle, model, length, humanised };
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const rel = await saveVariant({
      ...base,
      body: c.body,
      variantIndex: i + 1,
      selected: i === chosen,
    });
    await stampLint(rel, c.lint.hard, c.lint.soft, attempts, []);
  }
  const postRel = await savePost({
    ...base,
    body,
    ...(humanised ? { rawBody: raw } : {}),
  });
  await stampLint(postRel, finalLint.hard, finalLint.soft, attempts, notes);

  return {
    platform,
    path: postRel,
    passed: finalLint.passed,
    hard: finalLint.hard,
    soft: finalLint.soft,
    variants: candidates.length,
    humanised,
    model,
    attempts,
    notes,
  };
}

/**
 * Drafts one post per platform in parallel (default: all three) and saves them under content/daily/<date>/.
 * Hard lint failures stay as drafts and are reported; they are never exported in M1.
 * voiceFile is a path under content/ (default voice.md). It is only read, never created.
 */
export async function draftDaily(input: {
  date: string;
  topic: string;
  angle: string;
  /** Carousel angles are out of M1 and rejected before any call. */
  format?: "text" | "carousel";
  platforms?: Platform[];
  voiceFile?: string;
}): Promise<DraftDailyResult> {
  if (input.format === "carousel") throw new Error("Carousel angles are not drafted in M1");
  if (typeof input.topic !== "string" || input.topic.trim() === "") throw new Error("Topic must be a non-empty string.");
  if (typeof input.angle !== "string" || input.angle.trim() === "") throw new Error("Angle must be a non-empty string.");
  const platforms = input.platforms ?? [...PLATFORMS];
  if (platforms.length === 0) throw new Error("Pick at least one platform.");
  for (const p of platforms) if (!(PLATFORMS as readonly string[]).includes(p)) throw new Error("Unknown platform.");

  // Never overwrite: check every target before any model call.
  const targets: string[] = [];
  for (const p of platforms) {
    targets.push(postPath(input.date, p), rawPath(input.date, p));
    for (let i = 1; i <= 3; i++) targets.push(variantPath(input.date, p, i));
  }
  await assertNoneExist(targets);

  const voiceText = await readVoice(input.voiceFile ?? "voice.md");
  const voice = voiceText ?? NO_VOICE;
  const shared = { date: input.date, topic: input.topic, angle: input.angle, voice, voiceMissing: voiceText === null };

  const settled = await Promise.allSettled(platforms.map((p) => draftOne(p, shared)));
  const results = settled.map((s, i): PlatformResult => {
    if (s.status === "fulfilled") return s.value;
    const msg = s.reason instanceof Error ? s.reason.message : "unknown error";
    return {
      platform: platforms[i],
      path: "",
      passed: false,
      hard: [],
      soft: [],
      variants: 0,
      humanised: false,
      model: "",
      attempts: [],
      notes: [`error: ${msg}`],
    };
  });
  return { results };
}
