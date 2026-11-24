import { assertDateISO, assertWeekId } from "../../store/weeks";
import { WeekError } from "./errors";

// Date helpers for the Week. Dates are calendar dates (YYYY-MM-DD) and do not depend on the machine's time zone.

export const DATE_FOLDER = /^\d{4}-\d{2}-\d{2}$/;
export const WEEK_PATH = /^weeks\/\d{4}-W\d{2}$/;

export function requireWeekId(weekId: unknown): string {
  try {
    assertWeekId(weekId as string);
  } catch {
    throw new WeekError("bad_request", `Week id must look like 2026-W48. Got "${String(weekId)}".`);
  }
  return weekId as string;
}

export function requireDateISO(value: unknown): string {
  try {
    assertDateISO(value as string);
  } catch {
    throw new WeekError("bad_request", `Start date must look like 2026-11-23. Got "${String(value)}".`);
  }
  return value as string;
}

// Takes the week id from the last part of a content-relative week path such as weeks/2026-W48.
export function weekIdFromPath(weekPath: string): string {
  const parts = weekPath.split("/");
  if (parts.length < 2 || parts.includes("..")) {
    throw new WeekError("bad_request", `Week path is not valid: ${weekPath}`);
  }
  return requireWeekId(parts[parts.length - 1]);
}

// 1 for Monday to 7 for Sunday.
export function dayOfWeek(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

export function addDays(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// ISO week id (Monday start, week 1 holds the first Thursday) for a calendar date.
export function isoWeekIdForDate(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// The Monday that starts an ISO week id such as 2026-W48 (returns 2026-11-23).
export function mondayOfIsoWeek(weekId: string): string {
  const [year, week] = weekId.split("-W").map(Number);
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Day = new Date(jan4).getUTCDay() || 7;
  const week1Monday = jan4 - (jan4Day - 1) * 86_400_000;
  return new Date(week1Monday + (week - 1) * 7 * 86_400_000).toISOString().slice(0, 10);
}
