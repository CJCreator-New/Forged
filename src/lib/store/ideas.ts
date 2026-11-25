import { readMarkdown, writeMarkdown } from "./markdown";
import { assertDate, assertSlug, ideaPath, slugify } from "./daily";

export type SaveIdeasInput = {
  date: string;
  topic: string;
  model: string;
  angles: unknown;
  slug?: string;
  trendSources?: string[];
  created?: string;
};

// Writes content/ideas/YYYY-MM-DD-<slug>.md. Returns the path relative to content/.
export async function saveIdeas(input: SaveIdeasInput): Promise<string> {
  const date = assertDate(input.date);
  if (typeof input.topic !== "string" || input.topic.trim() === "") {
    throw new Error("Topic must be a non-empty string.");
  }
  const slug = input.slug === undefined ? slugify(input.topic) : assertSlug(input.slug);
  const rel = ideaPath(date, slug);
  const json = JSON.stringify(input.angles, null, 2);
  if (json === undefined) throw new Error("Angles must be JSON-serialisable.");
  await writeMarkdown(rel, {
    data: {
      topic: input.topic,
      created: input.created ?? new Date().toISOString(),
      model: input.model,
      trend_sources: input.trendSources ?? [],
      picked: null,
    },
    body: `\n\`\`\`json\n${json}\n\`\`\`\n\n## Your pick\n`,
  });
  return rel;
}

export async function readIdeas(date: string, slug: string) {
  return readMarkdown(ideaPath(date, slug));
}
