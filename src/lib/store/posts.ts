import { promises as fs } from "node:fs";
import { readMarkdown, writeMarkdown, type MarkdownDoc } from "./markdown";
import { resolveContentPath } from "./paths";
import {
  PLATFORMS,
  assertDate,
  assertPlatform,
  assertVariantIndex,
  dailyDir,
  postPath,
  rawPath,
  variantPath,
  type Platform,
} from "./daily";

export type PostLength = "short" | "medium" | "long";

export type PostInput = {
  date: string;
  platform: string;
  topic: string;
  angle: string;
  model: string;
  body: string;
  length: PostLength;
  humanised: boolean;
  reviewRequired?: boolean;
  variantIndex?: number;
  selected?: boolean;
  created?: string;
  // Pre-humanise text. Saved to raw/<platform>.md only when humanised is true.
  rawBody?: string;
};

const LENGTHS: readonly string[] = ["short", "medium", "long"];

function buildDoc(input: PostInput, date: string, platform: Platform, selected: boolean): MarkdownDoc {
  if (!LENGTHS.includes(input.length)) throw new Error("Length must be short, medium or long.");
  const index = input.variantIndex === undefined ? 1 : assertVariantIndex(input.variantIndex);
  const id = selected ? `${date}-${platform}` : `${date}-${platform}-v${index}`;
  return {
    data: {
      id,
      platform,
      status: "draft",
      topic: input.topic,
      angle: input.angle,
      format: "text",
      model: input.model,
      created: input.created ?? new Date().toISOString(),
      edit_rating: null,
      review_required: input.reviewRequired ?? false,
      lint: { hard: [], soft: [] },
      variant_index: index,
      selected,
      length: input.length,
      humanised: input.humanised,
      rendered: false,
    },
    body: `\n${input.body}\n`,
  };
}

// Saves the chosen body to content/daily/<date>/<platform>.md. Returns the relative path.
export async function savePost(input: PostInput): Promise<string> {
  const date = assertDate(input.date);
  const platform = assertPlatform(input.platform);
  const rel = postPath(date, platform);
  await writeMarkdown(rel, buildDoc(input, date, platform, true));
  if (input.humanised && typeof input.rawBody === "string") {
    await writeMarkdown(rawPath(date, platform), {
      data: { id: `${date}-${platform}-raw`, platform, humanised: false },
      body: `\n${input.rawBody}\n`,
    });
  }
  return rel;
}

// Saves one variant to content/daily/<date>/variants/<platform>-v<n>.md. Returns the relative path.
export async function saveVariant(input: PostInput & { variantIndex: number }): Promise<string> {
  const date = assertDate(input.date);
  const platform = assertPlatform(input.platform);
  const rel = variantPath(date, platform, input.variantIndex);
  await writeMarkdown(rel, buildDoc(input, date, platform, input.selected ?? false));
  return rel;
}

export async function readPost(
  date: string,
  platform: string,
  variantIndex?: number,
): Promise<{ path: string } & MarkdownDoc> {
  const rel =
    variantIndex === undefined ? postPath(date, platform) : variantPath(date, platform, variantIndex);
  const doc = await readMarkdown(rel);
  return { path: rel, ...doc };
}

// Relative paths of the selected posts saved for a day, in platform order.
export async function listDailyPosts(date: string): Promise<string[]> {
  const dir = dailyDir(assertDate(date));
  let names: string[];
  try {
    names = await fs.readdir(resolveContentPath(dir));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return PLATFORMS.filter((p) => names.includes(`${p}.md`)).map((p) => `${dir}/${p}.md`);
}
