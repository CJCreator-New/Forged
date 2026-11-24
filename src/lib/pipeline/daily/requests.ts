import { z } from "zod";
import { CHANNELS, LENGTHS, SWITCH_OVERRIDES } from "../../schemas/post";
import { DailyError } from "./errors";

// Request shapes for the daily routes. Paths are relative to content/ and checked by pattern,
// so a request can only point at a Day, a Post, or an idea file.

const DAY_SEGMENT = "weeks/\\d{4}-W\\d{2}/days/\\d{4}-\\d{2}-\\d{2}";

export const DAY_PATH = new RegExp(`^${DAY_SEGMENT}$`);
export const POST_PATH = new RegExp(`^${DAY_SEGMENT}/(${CHANNELS.join("|")})\\.md$`);
// Looser checks used inside the modules: they only need the Day folder or post file shape.
export const DAY_FOLDER_LIKE = /(^|\/)days\/\d{4}-\d{2}-\d{2}$/;
export const POST_FILE_LIKE = /(^|\/)days\/\d{4}-\d{2}-\d{2}\/(linkedin|instagram|facebook)\.md$/;
export const IDEA_PATH = /^ideas\/[a-z0-9][a-z0-9-]*\.md$/;

const dayPath = z.string().regex(DAY_PATH, "day_path must point to a Day folder");
const postPath = z.string().regex(POST_PATH, "post_path must point to a post file");

export const IdeasRequest = z.object({
  topic: z.string().trim().min(1, "topic is required").max(300, "topic is too long"),
  trend_mode: z.boolean(),
});

export const PickRequest = z.object({
  idea_file: z.string().regex(IDEA_PATH, "idea_file must point to a file in ideas/"),
  angle_index: z.number().int().nonnegative(),
  default_style: z.string().min(1).optional(),
});

export const DraftRequest = z.object({
  day_path: dayPath,
  channel: z.enum(CHANNELS),
  length: z.enum(LENGTHS),
  custom_target: z.number().int().positive().optional(),
  style: z.string().min(1),
  humanise: z.enum(SWITCH_OVERRIDES),
});

export const VariantsRequest = z.object({
  post_path: postPath,
  count: z.union([z.literal(2), z.literal(3)]).optional(),
});

export const SelectVariantRequest = z.object({
  post_path: postPath,
  variant_index: z.number().int().positive(),
});

export const LengthRequest = z.object({
  post_path: postPath,
  length: z.enum(LENGTHS),
  custom_target: z.number().int().positive().optional(),
});

export const PostOnlyRequest = z.object({ post_path: postPath });

// Validates a parsed JSON body and throws a bad_request DailyError with the first problem named.
export function parseRequest<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const where = issue.path.length > 0 ? `${issue.path.map(String).join(".")}: ` : "";
  throw new DailyError("bad_request", `${where}${issue.message}`);
}
