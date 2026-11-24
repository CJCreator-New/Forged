import { runWithFallback } from "../../gateway/fallback";
import { readMarkdown, writeMarkdown } from "../../store/markdown";
import { localIsoWithOffset, normaliseBody } from "../../store/posts";
import { WEEKS_DIR } from "../../store/weeks";
import { fileExists } from "../daily/post-io";
import { readVoice, VOICE_FILE } from "../daily/voice";
import { briefText, readWeekBrief } from "./brief";
import { WeekError } from "./errors";
import { requireWeekId } from "./ids";
import { buildPillarPrompt } from "./prompts";
import { markWeekPostsStale } from "./week-files";

// The Pillar is one long-form draft per Week, saved as pillar.md (CONTEXT: Pillar).

export const PILLAR_FILE = "pillar.md";

export type PillarOptions = { voicePath?: string };

export async function generatePillar(
  input: { week_path: string; replace?: boolean },
  opts: PillarOptions = {},
): Promise<{ pillar_path: string; stale_posts: string[] }> {
  const pillarRel = `${input.week_path}/${PILLAR_FILE}`;
  const hadPillar = await fileExists(pillarRel);
  if (hadPillar && input.replace !== true) {
    throw new WeekError(
      "pillar_exists",
      "This week already has a pillar. Edit it instead, or set replace to true to write a new one.",
    );
  }

  const brief = await readWeekBrief(input.week_path);
  const voice = await readVoice(opts.voicePath ?? VOICE_FILE);
  const prompt = buildPillarPrompt({ voice, brief: briefText(brief), angle: brief.goal });
  const result = await runWithFallback("pillar", [{ role: "user", content: prompt }]);

  const body = normaliseBody(result.text);
  if (body === "") {
    throw new WeekError("invalid_output", "The pillar came back empty. Try again.");
  }
  await writeMarkdown(pillarRel, {
    data: { created: localIsoWithOffset(), model: result.model_used },
    body,
  });

  // A replaced pillar makes the existing posts out of date, so they are flagged (never rewritten).
  const stale_posts = hadPillar ? await markWeekPostsStale(input.week_path) : [];
  return { pillar_path: pillarRel, stale_posts };
}

// Reads the Pillar body (trimmed). Throws pillar_missing when the Week has no pillar yet.
export async function readPillarBody(weekPath: string): Promise<string> {
  const pillarRel = `${weekPath}/${PILLAR_FILE}`;
  if (!(await fileExists(pillarRel))) {
    throw new WeekError("pillar_missing", "This week has no pillar yet. Write the pillar first.");
  }
  const doc = await readMarkdown(pillarRel);
  return doc.body.trim();
}

// Reads the Pillar for the Week page, by week id. Throws pillar_not_found (404) when there is none.
export async function readPillarForWeek(weekId: string, opts: { weeksBase?: string } = {}): Promise<string> {
  const week = requireWeekId(weekId);
  const pillarRel = `${opts.weeksBase ?? WEEKS_DIR}/${week}/${PILLAR_FILE}`;
  if (!(await fileExists(pillarRel))) {
    throw new WeekError("pillar_not_found", "This week has no pillar yet.");
  }
  const doc = await readMarkdown(pillarRel);
  return doc.body.trim();
}

// Saves the user's edited Pillar text, then marks every post in the Week stale. No post body changes.
export async function savePillar(
  input: { week_path: string; body: string },
): Promise<{ stale_posts: string[] }> {
  const pillarRel = `${input.week_path}/${PILLAR_FILE}`;
  if (!(await fileExists(pillarRel))) {
    throw new WeekError("not_found", "This week has no pillar yet. Write one first.");
  }
  const body = normaliseBody(input.body);
  if (body === "") {
    throw new WeekError("bad_request", "The pillar cannot be empty.");
  }
  const doc = await readMarkdown(pillarRel);
  await writeMarkdown(pillarRel, {
    data: { ...doc.data, updated: localIsoWithOffset() },
    body,
  });
  const stale_posts = await markWeekPostsStale(input.week_path);
  return { stale_posts };
}
