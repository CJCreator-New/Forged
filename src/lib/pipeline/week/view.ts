import { z } from "zod";
import { CHANNELS, ChannelSchema, type Channel } from "../../schemas/post";
import { readPost } from "../../store/posts";
import { WEEKS_DIR } from "../../store/weeks";
import { fileExists } from "../daily/post-io";
import { requireWeekId } from "./ids";
import { WeekError } from "./errors";
import { dirExists, listDayDates } from "./week-files";

// Read only. Shows the Week's Days and posts with their frontmatter status. Never writes.

const PostEntrySchema = z.object({
  path: z.string(),
  channel: ChannelSchema,
  status: z.string(),
  stale: z.boolean(),
  // Counts of hard and soft lint problems, the shape the Week page reads. Zero for an unreadable post.
  lint: z.object({ hard: z.number().int().nonnegative(), soft: z.number().int().nonnegative() }),
  lint_hard_count: z.number().int().nonnegative().nullable(),
  review_required: z.boolean().nullable(),
  format: z.string().nullable(),
});

export const WeekViewSchema = z.object({
  week: z.string(),
  brief_present: z.boolean(),
  pillar_present: z.boolean(),
  days: z.array(z.object({ date: z.string(), posts: z.array(PostEntrySchema) })),
});

export type WeekView = z.infer<typeof WeekViewSchema>;

export async function viewWeek(weekId: string, opts: { weeksBase?: string } = {}): Promise<WeekView> {
  const week = requireWeekId(weekId);
  const base = opts.weeksBase ?? WEEKS_DIR;
  const weekPath = `${base}/${week}`;
  if (!(await dirExists(weekPath))) {
    throw new WeekError("not_found", `No week ${week} exists yet.`);
  }

  const days = [];
  for (const date of await listDayDates(weekPath)) {
    const posts = [];
    for (const channel of CHANNELS) {
      const path = `${weekPath}/days/${date}/${channel}.md`;
      if (!(await fileExists(path))) continue;
      posts.push(await viewPost(path, channel));
    }
    days.push({ date, posts });
  }

  return WeekViewSchema.parse({
    week,
    brief_present: await fileExists(`${weekPath}/brief.md`),
    pillar_present: await fileExists(`${weekPath}/pillar.md`),
    days,
  });
}

async function viewPost(path: string, channel: Channel) {
  try {
    const { frontmatter } = await readPost(path);
    return {
      path,
      channel,
      status: frontmatter.status,
      stale: frontmatter.stale,
      lint: { hard: frontmatter.lint.hard.length, soft: frontmatter.lint.soft.length },
      lint_hard_count: frontmatter.lint.hard.length,
      review_required: frontmatter.review_required,
      format: frontmatter.format,
    };
  } catch {
    // One broken file must not hide the rest of the week. It is shown as unreadable.
    return {
      path,
      channel,
      status: "unreadable",
      stale: false,
      lint: { hard: 0, soft: 0 },
      lint_hard_count: null,
      review_required: null,
      format: null,
    };
  }
}
