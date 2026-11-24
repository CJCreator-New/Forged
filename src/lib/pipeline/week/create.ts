import { createDay, createWeek as createWeekFolder, WEEKS_DIR } from "../../store/weeks";
import { fileExists } from "../daily/post-io";
import { parseBrief, writeWeekBrief } from "./brief";
import { WeekError } from "./errors";
import { addDays, dayOfWeek, isoWeekIdForDate, mondayOfIsoWeek, requireDateISO, requireWeekId } from "./ids";

// Creates a Week: the Week folder, seven Day folders from a Monday, and brief.md.

export type CreateWeekInput = {
  week?: unknown;
  week_id?: unknown;
  start_date?: unknown;
  brief: unknown;
  replace?: boolean;
};

export type CreateWeekResult = { week_path: string; brief_path: string; days: string[] };

export async function createWeekFromBrief(
  input: CreateWeekInput,
  opts: { weeksBase?: string } = {},
): Promise<CreateWeekResult> {
  const base = opts.weeksBase ?? WEEKS_DIR;
  // "week" (sent by the Week page) wins over "week_id" when both are present.
  const weekId = requireWeekId(input.week ?? input.week_id);
  const start = requireDateISO(input.start_date ?? mondayOfIsoWeek(weekId));

  if (dayOfWeek(start) !== 1) {
    throw new WeekError("bad_request", `Start date ${start} is not a Monday. A Week starts on a Monday.`);
  }
  const isoWeek = isoWeekIdForDate(start);
  if (isoWeek !== weekId) {
    throw new WeekError("bad_request", `Start date ${start} falls in week ${isoWeek}, not ${weekId}.`);
  }

  const brief = parseBrief(input.brief);
  const weekPath = `${base}/${weekId}`;
  const briefPath = `${weekPath}/brief.md`;

  if ((await fileExists(briefPath)) && input.replace !== true) {
    throw new WeekError(
      "week_exists",
      `Week ${weekId} already has a brief. Set replace to true to overwrite the brief.`,
    );
  }

  await createWeekFolder(weekId, base);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(await createDay(weekId, addDays(start, i), base));
  }
  await writeWeekBrief(briefPath, brief);

  return { week_path: weekPath, brief_path: briefPath, days };
}
