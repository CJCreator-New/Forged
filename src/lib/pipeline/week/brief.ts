import { z } from "zod";
import { readMarkdown, writeMarkdown } from "../../store/markdown";
import { localIsoWithOffset } from "../../store/posts";
import { fileExists } from "../daily/post-io";
import { WeekError } from "./errors";

// The campaign brief for one Week, saved as brief.md (CONTEXT: Brief).

export const WeekBriefSchema = z.object({
  goal: z.string().trim().min(1, "goal is required").max(500),
  audience: z.string().trim().min(1, "audience is required").max(300),
  key_points: z
    .array(z.string().trim().min(1, "key points cannot be empty").max(300))
    .min(1, "add at least one key point")
    .max(10, "use at most 10 key points"),
  cta: z.string().trim().min(1, "call to action is required").max(200),
  link: z.union([z.url(), z.literal("")]).optional(),
});

export type WeekBrief = z.infer<typeof WeekBriefSchema>;

// The Week page sends call_to_action. Saved briefs use cta, so the request name is mapped to it here.
function withCta(input: unknown): unknown {
  if (input && typeof input === "object" && "call_to_action" in input && !("cta" in input)) {
    return { ...input, cta: (input as { call_to_action: unknown }).call_to_action };
  }
  return input;
}

// Validates a brief from a request. Empty optional link is dropped.
export function parseBrief(input: unknown): WeekBrief {
  const result = WeekBriefSchema.safeParse(withCta(input));
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue.path.length > 0 ? `${issue.path.map(String).join(".")}: ` : "";
    throw new WeekError("bad_request", `${where}${issue.message}`);
  }
  const brief = result.data;
  if (brief.link === "") delete brief.link;
  return brief;
}

// Plain-text version of the brief. Used as the body of brief.md and as data in the pillar prompt.
export function briefText(brief: WeekBrief): string {
  const lines = [
    "# Campaign brief",
    "",
    `Goal: ${brief.goal}`,
    "",
    `Audience: ${brief.audience}`,
    "",
    "Key points:",
    ...brief.key_points.map((p) => `- ${p}`),
    "",
    `Call to action: ${brief.cta}`,
  ];
  if (brief.link) lines.push("", `Link: ${brief.link}`);
  return `${lines.join("\n")}\n`;
}

export async function writeWeekBrief(briefRel: string, brief: WeekBrief): Promise<void> {
  const data: Record<string, unknown> = {
    goal: brief.goal,
    audience: brief.audience,
    key_points: brief.key_points,
    cta: brief.cta,
    created: localIsoWithOffset(),
  };
  if (brief.link) data.link = brief.link;
  await writeMarkdown(briefRel, { data, body: briefText(brief) });
}

// Reads brief.md for a Week and checks it. Throws brief_missing when there is no usable brief.
export async function readWeekBrief(weekPath: string): Promise<WeekBrief> {
  const rel = `${weekPath}/brief.md`;
  if (!(await fileExists(rel))) {
    throw new WeekError("brief_missing", "This week has no brief yet. Save a brief first.");
  }
  const doc = await readMarkdown(rel);
  const parsed = WeekBriefSchema.safeParse(doc.data);
  if (!parsed.success) {
    throw new WeekError("brief_missing", "The brief for this week is not readable. Save the brief again.");
  }
  return parsed.data;
}
