import { z } from "zod";
import { readSwitches, type Switches } from "../../config/switches";
import { GatewayError } from "../../gateway/errors";
import { CHANNELS, LENGTHS, type Channel, type PostFrontmatter } from "../../schemas/post";
import { isUserEdited, localIsoWithOffset, readPost, replaceGeneratedBody, StoreError, writePost } from "../../store/posts";
import { channelTask, isReviewTopic, resolveLength, type Length } from "../daily/channel";
import { checkStyle } from "../daily/draft";
import { finishBody, generateChannelBody, humaniseDecision } from "../daily/generate";
import { fileExists, presentLint, updatePostFields, writeRawSafe } from "../daily/post-io";
import { readVoice, VOICE_FILE } from "../daily/voice";
import { readWeekBrief, type WeekBrief } from "./brief";
import { WeekError } from "./errors";
import { weekIdFromPath } from "./ids";
import { readPillarBody } from "./pillar";
import { mapWithConcurrency } from "./pool";
import { listDayDates } from "./week-files";

// Adapts all posts of one Week from pillar.md (P3, P4, P5). Uses the same channel draft steps as the daily flow.
// Posts the user has edited are skipped. Other existing posts get a new body and keep the old one as a version.

export const ADAPT_CONCURRENCY = 3;
// Used for new posts. The Week has no style setting yet, so the default preset is conversational.
export const DEFAULT_WEEK_STYLE = "conversational";

const LintSchema = z.object({ hard: z.array(z.string()), soft: z.array(z.string()) });

export const AdaptResponseSchema = z.object({
  posts: z.array(
    z.object({
      path: z.string(),
      status: z.enum(["created", "replaced", "skipped_user_edited", "failed"]),
      lint: LintSchema.nullable(),
      error: z.object({ code: z.string(), message: z.string() }).optional(),
    }),
  ),
});

export type AdaptResult = z.infer<typeof AdaptResponseSchema>;
export type AdaptItem = AdaptResult["posts"][number];

export type AdaptOptions = { voicePath?: string; now?: Date; concurrency?: number };

type Job = { path: string; channel: Channel; date: string };
type Context = {
  voice: string;
  pillar: string;
  brief: WeekBrief;
  switches: Switches;
  now: Date;
};

function weekLength(value: string): Length {
  const allowed = (LENGTHS as readonly string[]).includes(value) && value !== "custom";
  return allowed ? (value as Length) : "medium";
}

export async function adaptWeek(input: { week_path: string }, opts: AdaptOptions = {}): Promise<AdaptResult> {
  weekIdFromPath(input.week_path);
  const pillar = await readPillarBody(input.week_path);
  const brief = await readWeekBrief(input.week_path);
  const voice = await readVoice(opts.voicePath ?? VOICE_FILE);
  const dates = await listDayDates(input.week_path);
  if (dates.length === 0) {
    throw new WeekError("not_found", "This week has no days yet. Create the week again.");
  }

  const jobs: Job[] = dates.flatMap((date) =>
    CHANNELS.map((channel) => ({ path: `${input.week_path}/days/${date}/${channel}.md`, channel, date })),
  );
  const ctx: Context = { voice, pillar, brief, switches: readSwitches(), now: opts.now ?? new Date() };

  const posts = await mapWithConcurrency(jobs, opts.concurrency ?? ADAPT_CONCURRENCY, (job) => adaptPost(job, ctx));
  return AdaptResponseSchema.parse({ posts });
}

async function adaptPost(job: Job, ctx: Context): Promise<AdaptItem> {
  try {
    const exists = await fileExists(job.path);
    let previous: PostFrontmatter | null = null;
    if (exists) {
      previous = (await readPost(job.path)).frontmatter;
      // Checked before any model call, so an edited post costs nothing (ADR 0007).
      if (await isUserEdited(job.path)) {
        return { path: job.path, status: "skipped_user_edited", lint: presentLint(previous.lint, ctx.switches.linter_soft_warnings) };
      }
    }

    const length = previous ? previous.length : weekLength(ctx.switches.length);
    const style = previous ? previous.style : DEFAULT_WEEK_STYLE;
    checkStyle(style);
    const target = resolveLength(job.channel, length, previous?.custom_target);
    const generated = await generateChannelBody({
      voice: ctx.voice,
      channel: job.channel,
      length: target,
      styleId: style,
      source: ctx.pillar,
    });
    const finished = await finishBody({
      voice: ctx.voice,
      channel: job.channel,
      channelTaskText: channelTask(job.channel, target),
      topic: ctx.brief.goal,
      text: generated.body,
      runHumanise: humaniseDecision(previous ? previous.humanise : "inherit", ctx.switches.humanise),
    });
    if (finished.raw !== undefined) await writeRawSafe(job.path, finished.raw);

    const created = localIsoWithOffset(ctx.now);
    const lint = presentLint(finished.lint, ctx.switches.linter_soft_warnings);

    if (!previous) {
      const frontmatter: Partial<PostFrontmatter> & Record<string, unknown> = {
        id: `${job.date}-${job.channel}`,
        channel: job.channel,
        status: "draft",
        topic: ctx.brief.goal,
        angle: ctx.brief.goal,
        format: "text",
        model: generated.model,
        created,
        length,
        style,
        humanise: "inherit",
        humanised: finished.humanised,
        variant_index: 1,
        selected: true,
        rendered: false,
        edit_rating: null,
        review_required: isReviewTopic(ctx.brief.goal),
        stale: false,
        lint: finished.lint,
      };
      if (generated.fallback_from) frontmatter.fallback_from = generated.fallback_from;
      await writePost(job.path, frontmatter, finished.body);
      return { path: job.path, status: "created", lint };
    }

    await replaceGeneratedBody(job.path, finished.body);
    await updatePostFields(
      job.path,
      {
        status: "draft",
        stale: false,
        format: "text",
        model: generated.model,
        created,
        humanised: finished.humanised,
        review_required: isReviewTopic(ctx.brief.goal),
        lint: finished.lint,
        ...(generated.fallback_from ? { fallback_from: generated.fallback_from } : {}),
      },
      generated.fallback_from ? [] : ["fallback_from"],
    );
    return { path: job.path, status: "replaced", lint };
  } catch (err) {
    // A missing key is the same for every post, so it stops the whole run.
    if (err instanceof GatewayError && err.code === "missing_key") throw err;
    // A user edit that landed while this post was generating is skipped, not failed.
    if (err instanceof StoreError && err.code === "user_edited") {
      return { path: job.path, status: "skipped_user_edited", lint: null };
    }
    const code = typeof (err as { code?: unknown })?.code === "string" ? (err as { code: string }).code : "failed";
    const message = err instanceof Error ? err.message : "This post could not be adapted.";
    return { path: job.path, status: "failed", lint: null, error: { code, message } };
  }
}
