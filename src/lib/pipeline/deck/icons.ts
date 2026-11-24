import { promises as fs } from "node:fs";
import { isNotFound } from "./http";

// Lists icon names from an icon folder (public/icons/*.svg). A missing or empty folder gives an empty list.
export async function listIcons(dir: string, query?: string): Promise<string[]> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch (err) {
    if (isNotFound(err)) return [];
    throw err;
  }
  const q = (query ?? "").trim().toLowerCase();
  return names
    .filter((name) => name.toLowerCase().endsWith(".svg"))
    .map((name) => name.slice(0, -".svg".length))
    .filter((name) => q === "" || name.toLowerCase().includes(q))
    .sort();
}
