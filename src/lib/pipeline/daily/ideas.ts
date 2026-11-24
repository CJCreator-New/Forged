import { promises as fs } from "node:fs";
import { fetchTrendContext } from "../trend/trend";
import { runJson } from "../../gateway/json";
import { IdeasSchema, type Angle } from "../../schemas/ideas";
import { writeMarkdown } from "../../store/markdown";
import { resolveContentPath } from "../../store/paths";
import { localIsoWithOffset } from "../../store/posts";
import { DailyError } from "./errors";
import { channelSummary } from "./channel";
import { readVoice, VOICE_FILE } from "./voice";
import { buildIdeasPrompt, type TrendItem } from "./prompts";

export const IDEAS_DIR = "ideas";

export type IdeasResult = {
  angles: Angle[];
  trend_sources?: TrendItem[];
  idea_file: string;
  model: string;
};

export type IdeasOptions = {
  voicePath?: string;
  ideasDir?: string;
  now?: Date;
  fetchTrend?: typeof fetchTrendContext;
};

// Lowercase ASCII words joined by hyphens. Used in the idea file name.
export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug === "" ? "topic" : slug;
}

// Picks ideas/YYYY-MM-DD-slug.md, adding -2, -3 and so on if the name is taken. Existing files are never overwritten.
async function uniqueIdeaPath(dir: string, dateISO: string, slug: string): Promise<string> {
  for (let n = 1; ; n++) {
    const name = n === 1 ? `${dateISO}-${slug}.md` : `${dateISO}-${slug}-${n}.md`;
    const rel = `${dir}/${name}`;
    try {
      await fs.access(resolveContentPath(rel));
    } catch {
      return rel;
    }
  }
}

// Topic to angles (P1). Trend mode runs first. A failed trend search stops the flow and writes nothing.
export async function generateIdeas(
  input: { topic: string; trend_mode: boolean },
  opts: IdeasOptions = {},
): Promise<IdeasResult> {
  const topic = input.topic.trim();
  if (topic === "") throw new DailyError("bad_request", "Enter a topic first.");

  const voice = await readVoice(opts.voicePath ?? VOICE_FILE);

  let trendItems: TrendItem[] = [];
  if (input.trend_mode) {
    const fetchTrend = opts.fetchTrend ?? fetchTrendContext;
    let result: Awaited<ReturnType<typeof fetchTrendContext>>;
    try {
      result = await fetchTrend(topic);
    } catch (err) {
      // The trend module already gives a plain reason (for example the monthly cap or a missing key).
      const reason = err instanceof Error && err.message ? err.message : "The trend search failed.";
      const key = (err as { key?: unknown }).key;
      throw new DailyError(
        "trend_failed",
        `${reason} No angles were made. Turn trend mode off to continue without search, or try again.`,
        { key: typeof key === "string" ? key : undefined },
      );
    }
    if (result.skipped) {
      throw new DailyError(
        "trend_failed",
        "Trend mode is switched off in settings, so no trend search ran. Turn it on, or turn trend mode off for this request.",
      );
    }
    trendItems = result.items;
  }

  const prompt = buildIdeasPrompt({ voice, channelSpec: channelSummary(), topic, trendItems });
  const result = await runJson("ideas", [{ role: "user", content: prompt }], IdeasSchema);

  // Only URLs from the trend context may be cited (P1). Anything else is dropped.
  const allowed = new Set(trendItems.map((t) => t.url));
  const angles: Angle[] = result.data.map((a) => ({
    ...a,
    source_urls: a.source_urls.filter((u) => allowed.has(u)),
  }));

  const now = opts.now ?? new Date();
  const dateISO = localIsoWithOffset(now).slice(0, 10);
  const dir = opts.ideasDir ?? IDEAS_DIR;
  const ideaFile = await uniqueIdeaPath(dir, dateISO, slugify(topic));

  const body = ["```json", JSON.stringify(angles, null, 2), "```", ""].join("\n");
  await writeMarkdown(ideaFile, {
    data: {
      topic,
      created: localIsoWithOffset(now),
      trend_sources: trendItems,
      model: result.model_used,
    },
    body,
  });

  return {
    angles,
    ...(input.trend_mode ? { trend_sources: trendItems } : {}),
    idea_file: ideaFile,
    model: result.model_used,
  };
}
