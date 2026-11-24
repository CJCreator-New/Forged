import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveContentPath } from "./paths";

// Week ids look like 2026-W48 (ISO week, 01 to 53).
const WEEK_ID = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;
// Day ids look like 2026-11-24.
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Folder that holds all weeks. Tests pass a different base inside content/.
export const WEEKS_DIR = "weeks";

export function assertWeekId(weekId: string): void {
  if (typeof weekId !== "string" || !WEEK_ID.test(weekId)) {
    throw new Error(`Invalid week id "${weekId}". Expected a format like 2026-W48.`);
  }
}

export function assertDateISO(dateISO: string): void {
  if (typeof dateISO !== "string" || !DATE_ISO.test(dateISO)) {
    throw new Error(`Invalid date "${dateISO}". Expected YYYY-MM-DD.`);
  }
  const [y, m, d] = dateISO.split("-").map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new Error(`Invalid calendar date "${dateISO}".`);
  }
}

// Creates content/<base>/<weekId>/days/. Safe to call again: existing folders are kept.
export async function createWeek(weekId: string, base: string = WEEKS_DIR): Promise<string> {
  assertWeekId(weekId);
  const weekRel = path.posix.join(base, weekId);
  await fs.mkdir(resolveContentPath(path.posix.join(weekRel, "days")), { recursive: true });
  return weekRel;
}

// Creates content/<base>/<weekId>/days/<dateISO>/ and returns its path relative to content/.
export async function createDay(
  weekId: string,
  dateISO: string,
  base: string = WEEKS_DIR,
): Promise<string> {
  assertWeekId(weekId);
  assertDateISO(dateISO);
  const dayRel = path.posix.join(base, weekId, "days", dateISO);
  await fs.mkdir(resolveContentPath(dayRel), { recursive: true });
  return dayRel;
}
