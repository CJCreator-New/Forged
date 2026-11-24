import { promises as fs } from "node:fs";
import { z } from "zod";
import { getStyle } from "../../config/loaders";
import { ConfigError } from "../../config/errors";
import { AngleSchema, IdeasSchema, type Angle } from "../../schemas/ideas";
import { CHANNELS, FormatSchema, type Channel } from "../../schemas/post";
import { readMarkdown, writeMarkdown } from "../../store/markdown";
import { resolveContentPath } from "../../store/paths";
import { createDay } from "../../store/weeks";
import { localIsoWithOffset } from "../../store/posts";
import { DailyError } from "./errors";

// A Day holds the chosen angle as brief.md. Posts are created later by drafting, one per channel.

export const WEEKS_DIR = "weeks";

export const BriefSchema = z.object({
  topic: z.string().min(1),
  angle_title: z.string().min(1),
  hooks: AngleSchema.shape.hooks,
  why_it_could_travel: z.string().min(1),
  format: FormatSchema,
  idea_file: z.string().min(1),
  default_style: z.string().min(1).optional(),
  created: z.string().min(1),
});

export type Brief = z.infer<typeof BriefSchema>;

// ISO week id such as 2026-W48, from a local calendar date.
export function isoWeekId(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function localDateISO(date: Date): string {
  return localIsoWithOffset(date).slice(0, 10);
}

// Pulls the angles array out of an idea file's JSON block and validates it.
export function parseIdeaBody(body: string): Angle[] {
  const match = /```json\s*\n([\s\S]*?)\n```/.exec(body);
  if (!match) throw new DailyError("not_found", "This idea file has no angles in it.");
  let raw: unknown;
  try {
    raw = JSON.parse(match[1]);
  } catch {
    throw new DailyError("not_found", "The angles in this idea file are not readable JSON.");
  }
  const parsed = IdeasSchema.safeParse(raw);
  if (!parsed.success) throw new DailyError("not_found", "The angles in this idea file are not in the expected shape.");
  return parsed.data;
}

export async function readBrief(dayPath: string): Promise<Brief> {
  const rel = `${dayPath}/brief.md`;
  try {
    await fs.access(resolveContentPath(rel));
  } catch {
    throw new DailyError("not_found", "This day has no angle yet. Pick an angle first.");
  }
  const doc = await readMarkdown(rel);
  const parsed = BriefSchema.safeParse(doc.data);
  if (!parsed.success) throw new DailyError("not_found", "The brief for this day is not readable. Pick the angle again.");
  return parsed.data;
}

export type PickResult = {
  day_path: string;
  posts: { channel: Channel; post_path: string }[];
};

export type PickOptions = { weeksBase?: string; now?: Date };

// Creates the Day, writes the chosen angle as brief.md, and records the default style if given.
// Posts are not written here. Drafting creates each post file, since post files are create-only.
export async function pickAngle(
  input: { idea_file: string; angle_index: number; default_style?: string },
  opts: PickOptions = {},
): Promise<PickResult> {
  if (!/(^|\/)ideas\/[^/]+\.md$/.test(input.idea_file)) {
    throw new DailyError("bad_request", "idea_file must point to a file in ideas/.");
  }
  let doc: Awaited<ReturnType<typeof readMarkdown>>;
  try {
    doc = await readMarkdown(input.idea_file);
  } catch {
    throw new DailyError("not_found", "That idea file was not found.");
  }
  const topic = typeof doc.data.topic === "string" ? doc.data.topic : "";
  if (topic === "") throw new DailyError("not_found", "That idea file has no topic.");

  const angles = parseIdeaBody(doc.body);
  if (input.angle_index >= angles.length) {
    throw new DailyError("bad_request", `angle_index must be between 0 and ${angles.length - 1}.`);
  }
  const angle = angles[input.angle_index];

  if (input.default_style !== undefined) {
    try {
      getStyle(input.default_style);
    } catch (err) {
      if (err instanceof ConfigError) throw new DailyError("bad_request", `Unknown writing style "${input.default_style}".`);
      throw err;
    }
  }

  const now = opts.now ?? new Date();
  const weekId = isoWeekId(now);
  const dateISO = localDateISO(now);
  const dayPath = await createDay(weekId, dateISO, opts.weeksBase ?? WEEKS_DIR);

  const briefRel = `${dayPath}/brief.md`;
  if (await briefExists(briefRel)) {
    throw new DailyError("day_exists", "This day already has an angle. Open the day to change it.");
  }

  const brief: Brief = {
    topic,
    angle_title: angle.title,
    hooks: angle.hooks,
    why_it_could_travel: angle.why_it_could_travel,
    format: angle.format,
    idea_file: input.idea_file,
    ...(input.default_style ? { default_style: input.default_style } : {}),
    created: localIsoWithOffset(now),
  };
  await writeMarkdown(briefRel, { data: brief, body: briefText(brief) });

  return {
    day_path: dayPath,
    posts: CHANNELS.map((channel) => ({ channel, post_path: `${dayPath}/${channel}.md` })),
  };
}

async function briefExists(rel: string): Promise<boolean> {
  try {
    await fs.access(resolveContentPath(rel));
    return true;
  } catch {
    return false;
  }
}

export function briefText(brief: Brief): string {
  const hooks = brief.hooks.map((h) => `- ${h}`).join("\n");
  return `# ${brief.angle_title}\n\nFormat: ${brief.format}\n\nWhy it could travel: ${brief.why_it_could_travel}\n\nHook options:\n${hooks}\n`;
}
