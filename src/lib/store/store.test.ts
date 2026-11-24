import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CONTENT_ROOT } from "./paths";
import { writeMarkdown } from "./markdown";
import { createDay, createWeek } from "./weeks";
import {
  clearStale,
  hashBody,
  isUserEdited,
  markStale,
  readPost,
  replaceGeneratedBody,
  saveVersion,
  StoreError,
  writePost,
  writeRaw,
} from "./posts";

// Every test works inside its own folder under content/, which is removed afterwards.
const BASE = `_test_${Math.random().toString(36).slice(2, 10)}`;
const WEEKS = `${BASE}/weeks`;
const POST = `${WEEKS}/2026-W48/days/2026-11-24/linkedin.md`;

const frontmatter = {
  id: "post-1",
  channel: "linkedin",
  status: "draft",
  topic: "AI at work",
  angle: "Small wins",
  format: "text",
  model: "nvidia/nemotron-3-ultra-550b-a55b:free",
  created: "2026-11-24T09:00:00+05:30",
  length: "medium",
  style: "direct",
  humanise: "inherit",
  humanised: false,
  variant_index: 1,
  selected: true,
  rendered: false,
  edit_rating: null,
  review_required: false,
  stale: false,
  lint: { hard: [], soft: [] },
};

async function editBodyOnDisk(rel: string, newBody: string): Promise<void> {
  const file = path.join(CONTENT_ROOT, rel);
  const raw = await fs.readFile(file, "utf8");
  const head = raw.slice(0, raw.indexOf("---", 3) + 3);
  await fs.writeFile(file, `${head}\n${newBody}\n`, "utf8");
}

afterEach(async () => {
  await fs.rm(path.join(CONTENT_ROOT, BASE), { recursive: true, force: true });
});

describe("createWeek and createDay", () => {
  it("rejects a bad week id", async () => {
    for (const bad of ["2026-48", "2026-W54", "2026-W00", "W48", "2026-W48/../x"]) {
      await expect(createWeek(bad, WEEKS)).rejects.toThrow(/Invalid week id/);
    }
  });

  it("creates the week folder with a days subfolder", async () => {
    const rel = await createWeek("2026-W48", WEEKS);
    expect(rel).toBe(`${WEEKS}/2026-W48`);
    const stat = await fs.stat(path.join(CONTENT_ROOT, WEEKS, "2026-W48", "days"));
    expect(stat.isDirectory()).toBe(true);
  });

  it("creates a day folder and returns its path", async () => {
    const rel = await createDay("2026-W48", "2026-11-24", WEEKS);
    expect(rel).toBe(`${WEEKS}/2026-W48/days/2026-11-24`);
    const stat = await fs.stat(path.join(CONTENT_ROOT, rel));
    expect(stat.isDirectory()).toBe(true);
  });

  it("rejects an impossible calendar date", async () => {
    await expect(createDay("2026-W48", "2026-02-30", WEEKS)).rejects.toThrow(/Invalid calendar date/);
  });
});

describe("posts", () => {
  it("writePost then readPost round trips and sets body_hash", async () => {
    await createDay("2026-W48", "2026-11-24", WEEKS);
    await writePost(POST, frontmatter, "Hello world.\n\nSecond paragraph.");
    const post = await readPost(POST);
    expect(post.frontmatter.id).toBe("post-1");
    expect(post.frontmatter.body_hash).toBe(hashBody("Hello world.\n\nSecond paragraph."));
    expect(post.body.trim()).toBe("Hello world.\n\nSecond paragraph.");
  });

  it("writePost refuses to overwrite an existing post", async () => {
    await createDay("2026-W48", "2026-11-24", WEEKS);
    await writePost(POST, frontmatter, "First.");
    await expect(writePost(POST, frontmatter, "Second.")).rejects.toMatchObject({ code: "exists" });
  });

  it("writePost rejects invalid frontmatter", async () => {
    await expect(writePost(POST, { ...frontmatter, channel: "myspace" }, "x")).rejects.toMatchObject({
      code: "invalid_post",
    });
  });

  it("readPost throws a clear error for invalid frontmatter on disk", async () => {
    await writeMarkdown(POST, { data: { id: "x" }, body: "body" });
    await expect(readPost(POST)).rejects.toThrow(/invalid frontmatter/);
  });

  it("writeRaw creates the raw copy once and refuses a second write", async () => {
    await createDay("2026-W48", "2026-11-24", WEEKS);
    await writePost(POST, frontmatter, "Polished.");
    const rawRel = await writeRaw(POST, "Raw text.");
    expect(rawRel).toBe(`${WEEKS}/2026-W48/days/2026-11-24/linkedin.raw.md`);
    await expect(writeRaw(POST, "Other raw.")).rejects.toMatchObject({ code: "exists" });
    const kept = await fs.readFile(path.join(CONTENT_ROOT, rawRel), "utf8");
    expect(kept).toBe("Raw text.");
  });

  it("isUserEdited is false after a write and true after a manual body edit", async () => {
    await createDay("2026-W48", "2026-11-24", WEEKS);
    await writePost(POST, frontmatter, "Generated text.");
    expect(await isUserEdited(POST)).toBe(false);
    await editBodyOnDisk(POST, "I changed this by hand.");
    expect(await isUserEdited(POST)).toBe(true);
  });

  it("isUserEdited treats a post with no body_hash as edited", async () => {
    await writeMarkdown(POST, { data: { ...frontmatter }, body: "No hash here." });
    expect(await isUserEdited(POST)).toBe(true);
  });

  it("replaceGeneratedBody refuses a user-edited post and changes nothing", async () => {
    await createDay("2026-W48", "2026-11-24", WEEKS);
    await writePost(POST, frontmatter, "Generated text.");
    await editBodyOnDisk(POST, "My own words.");
    await expect(replaceGeneratedBody(POST, "New generated text.")).rejects.toMatchObject({
      code: "user_edited",
    });
    const post = await readPost(POST);
    expect(post.body.trim()).toBe("My own words.");
  });

  it("replaceGeneratedBody with force saves the old body to versions/ first", async () => {
    await createDay("2026-W48", "2026-11-24", WEEKS);
    await writePost(POST, frontmatter, "Generated text.");
    await editBodyOnDisk(POST, "My own words.");
    const { versionPath } = await replaceGeneratedBody(POST, "New generated text.", { force: true });
    const saved = await fs.readFile(path.join(CONTENT_ROOT, versionPath), "utf8");
    expect(saved).toContain("My own words.");
    const post = await readPost(POST);
    expect(post.body.trim()).toBe("New generated text.");
    expect(await isUserEdited(POST)).toBe(false);
  });

  it("replaceGeneratedBody on an untouched post keeps the old body as a version", async () => {
    await createDay("2026-W48", "2026-11-24", WEEKS);
    await writePost(POST, frontmatter, "Generated text.");
    const { versionPath } = await replaceGeneratedBody(POST, "Regenerated text.");
    expect(versionPath).toMatch(/versions[\\/]linkedin-version-.*\.md$/);
    const saved = await fs.readFile(path.join(CONTENT_ROOT, versionPath), "utf8");
    expect(saved).toContain("Generated text.");
    expect((await readPost(POST)).body.trim()).toBe("Regenerated text.");
  });

  it("markStale and clearStale set and clear the flag without making the post look edited", async () => {
    await createDay("2026-W48", "2026-11-24", WEEKS);
    await writePost(POST, frontmatter, "\n\nBody with leading blank lines.\n\n");
    await markStale(POST);
    expect((await readPost(POST)).frontmatter.stale).toBe(true);
    expect(await isUserEdited(POST)).toBe(false);
    await clearStale(POST);
    expect((await readPost(POST)).frontmatter.stale).toBe(false);
    expect(await isUserEdited(POST)).toBe(false);
  });

  it("saveVersion writes a timestamped copy under versions/", async () => {
    await createDay("2026-W48", "2026-11-24", WEEKS);
    await writePost(POST, frontmatter, "Keep me.");
    const versionRel = await saveVersion(POST);
    expect(path.basename(versionRel)).toMatch(/^linkedin-version-.+\.md$/);
    const saved = await fs.readFile(path.join(CONTENT_ROOT, versionRel), "utf8");
    expect(saved).toContain("Keep me.");
  });
});

describe("path safety", () => {
  it("refuses writes that climb out of content/", async () => {
    await expect(writePost("../x.md", frontmatter, "x")).rejects.toThrow(/outside content/);
    await expect(writeRaw("../x.md", "x")).rejects.toThrow(/outside content/);
    await expect(createWeek("2026-W48", "../evil")).rejects.toThrow(/outside content/);
    await expect(createDay("2026-W48", "2026-11-24", "../evil")).rejects.toThrow(/outside content/);
    await expect(readPost("../x.md")).rejects.toThrow(/outside content/);
  });

  it("does not create anything outside content/", async () => {
    await expect(createWeek("2026-W48", "../evil")).rejects.toBeInstanceOf(Error);
    const outside = await fs.stat(path.resolve(CONTENT_ROOT, "..", "evil")).then(
      () => true,
      () => false,
    );
    expect(outside).toBe(false);
  });

  it("uses StoreError for store-level failures", () => {
    expect(new StoreError("user_edited", "x").code).toBe("user_edited");
  });
});
