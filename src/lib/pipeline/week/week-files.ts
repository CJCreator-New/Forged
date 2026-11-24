import { promises as fs } from "node:fs";
import { CHANNELS } from "../../schemas/post";
import { markStale } from "../../store/posts";
import { resolveContentPath } from "../../store/paths";
import { fileExists } from "../daily/post-io";
import { DATE_FOLDER } from "./ids";

// Finds the Day folders and post files inside one Week folder (weeks/<id>/days/<date>/<channel>.md).

export async function listDayDates(weekPath: string): Promise<string[]> {
  let names: string[];
  try {
    names = await fs.readdir(resolveContentPath(`${weekPath}/days`));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return names.filter((name) => DATE_FOLDER.test(name)).sort();
}

export async function listWeekPostPaths(weekPath: string): Promise<string[]> {
  const out: string[] = [];
  for (const date of await listDayDates(weekPath)) {
    for (const channel of CHANNELS) {
      const rel = `${weekPath}/days/${date}/${channel}.md`;
      if (await fileExists(rel)) out.push(rel);
    }
  }
  return out;
}

// Marks every post in the Week stale. Only the flag changes; bodies are never touched (ADR 0007).
export async function markWeekPostsStale(weekPath: string): Promise<string[]> {
  const paths = await listWeekPostPaths(weekPath);
  for (const path of paths) {
    await markStale(path);
  }
  return paths;
}

export async function dirExists(rel: string): Promise<boolean> {
  try {
    return (await fs.stat(resolveContentPath(rel))).isDirectory();
  } catch {
    return false;
  }
}
