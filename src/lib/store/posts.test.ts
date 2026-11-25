import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CONTENT_ROOT, resolveContentPath } from "./paths";
import { listDailyPosts, readPost, savePost, saveVariant, type PostInput } from "./posts";

// Tests write only under content/daily/2099-xx-xx, a date that never holds real data.
const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");
const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
const DATE = `2099-${month}-${day}`;

function input(over: Partial<PostInput> = {}): PostInput {
  return {
    date: DATE,
    platform: "linkedin",
    topic: "AI",
    angle: "Ops teams are automating the wrong step",
    model: "test/model",
    body: "Hello world.",
    length: "medium",
    humanised: false,
    ...over,
  };
}

afterEach(async () => {
  if (DATE.startsWith("2099-")) {
    await fs.rm(resolveContentPath(`daily/${DATE}`), { recursive: true, force: true });
  }
});

describe("posts store", () => {
  it("saves a post under content/daily with the full frontmatter", async () => {
    const rel = await savePost(input());
    expect(rel).toBe(`daily/${DATE}/linkedin.md`);
    const abs = path.join(CONTENT_ROOT, "daily", DATE, "linkedin.md");
    expect(existsSync(abs)).toBe(true);
    const post = await readPost(DATE, "linkedin");
    expect(post.data).toMatchObject({
      id: `${DATE}-linkedin`,
      platform: "linkedin",
      status: "draft",
      topic: "AI",
      format: "text",
      model: "test/model",
      edit_rating: null,
      review_required: false,
      lint: { hard: [], soft: [] },
      variant_index: 1,
      selected: true,
      length: "medium",
      humanised: false,
      rendered: false,
    });
    expect(post.body.trim()).toBe("Hello world.");
  });

  it("saves variants and raw copies in their folders", async () => {
    const v = await saveVariant(input({ variantIndex: 2 }) as PostInput & { variantIndex: number });
    expect(v).toBe(`daily/${DATE}/variants/linkedin-v2.md`);
    const variant = await readPost(DATE, "linkedin", 2);
    expect(variant.data.selected).toBe(false);
    expect(variant.data.variant_index).toBe(2);

    await savePost(input({ platform: "facebook", humanised: true, rawBody: "raw text" }));
    expect(existsSync(path.join(CONTENT_ROOT, "daily", DATE, "raw", "facebook.md"))).toBe(true);
  });

  it("lists only the posts that exist, in platform order", async () => {
    expect(await listDailyPosts(DATE)).toEqual([]);
    await savePost(input({ platform: "facebook" }));
    await savePost(input({ platform: "linkedin" }));
    expect(await listDailyPosts(DATE)).toEqual([`daily/${DATE}/linkedin.md`, `daily/${DATE}/facebook.md`]);
  });

  it("rejects bad platform, date, and traversal attempts", async () => {
    await expect(savePost(input({ platform: "twitter" }))).rejects.toThrow(/Platform/);
    await expect(savePost(input({ platform: "../x" }))).rejects.toThrow(/Platform/);
    await expect(savePost(input({ date: "../x" }))).rejects.toThrow(/Date/);
    await expect(savePost(input({ date: path.resolve("/", "tmp") }))).rejects.toThrow(/Date/);
    await expect(readPost("../x", "linkedin")).rejects.toThrow();
    await expect(listDailyPosts("../x")).rejects.toThrow();
    await expect(saveVariant(input({ variantIndex: 0 }) as PostInput & { variantIndex: number })).rejects.toThrow();
  });
});
