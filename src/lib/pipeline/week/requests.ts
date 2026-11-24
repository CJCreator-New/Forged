import { z } from "zod";
import { WEEK_PATH } from "./ids";

// Request shapes for the week routes. Paths are checked by pattern so a request can only point at a Week folder.

const weekPath = z.string().regex(WEEK_PATH, "week_path must look like weeks/2026-W48");

// The Week page sends "week". "week_id" is still accepted. start_date is optional: it defaults to the Monday of the week.
export const CreateWeekRequest = z.object({
  week: z.string().optional(),
  week_id: z.string().optional(),
  start_date: z.string().optional(),
  brief: z.unknown(),
  replace: z.boolean().optional(),
});

export const PillarCreateRequest = z.object({
  week_path: weekPath,
  replace: z.boolean().optional(),
});

export const PillarUpdateRequest = z.object({
  week_path: weekPath,
  body: z.string().max(40_000, "the pillar is too long"),
});

export const WeekPathRequest = z.object({ week_path: weekPath });
