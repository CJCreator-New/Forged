import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CONTENT_ROOT } from "./paths";
import { readIdeas, saveIdeas } from "./ideas";

// Tests write one file under content/ideas with a 2099 date and a random slug, then delete exactly that file.
const SLUG = `test-${Math.random().toString(36).slice(2, 10)}`;
const DATE = "2099-01-15";
const FILE = path.join(CONTENT_ROOT, "ideas", `${DATE}-${SLUG}.md`);

afterEach(async () => {
  await fs.rm(FILE, { force: true });
});

describe("ideas store", () => {
  it("saves ideas with frontmatter, a json block, and a pick section", async () => {
    const angles = [{ title: "One", hook: "Hook" }];
    const rel = await saveIdeas({ date: DATE, topic: "AI", model: "test/model", angles, slug: SLUG });
    expect(rel).toBe(`ideas/${DATE}-${SLUG}.md`);
    expect(existsSync(FILE)).toBe(true);
    const doc = await readIdeas(DATE, SLUG);
    expect(doc.data).toMatchObject({ topic: "AI", model: "test/model", trend_sources: [], picked: null });
    expect(doc.data.created).toBeTruthy();
    expect(doc.body).toContain("```json");
    expect(doc.body).toContain('"title": "One"');
    expect(doc.body).toContain("## Your pick");
  });

  it("derives the slug from the topic when none is given", async () => {
    const rel = await saveIdeas({ date: DATE, topic: SLUG, model: "m", angles: [] });
    expect(rel).toBe(`ideas/${DATE}-${SLUG}.md`);
  });

  it("rejects bad slugs, dates, and traversal", async () => {
    await expect(saveIdeas({ date: DATE, topic: "AI", model: "m", angles: [], slug: "../x" })).rejects.toThrow(/Slug/);
    await expect(
      saveIdeas({ date: DATE, topic: "AI", model: "m", angles: [], slug: path.resolve("/", "etc") }),
    ).rejects.toThrow(/Slug/);
    await expect(saveIdeas({ date: "../x", topic: "AI", model: "m", angles: [] })).rejects.toThrow(/Date/);
    await expect(saveIdeas({ date: DATE, topic: "  ", model: "m", angles: [] })).rejects.toThrow(/Topic/);
  });
});
