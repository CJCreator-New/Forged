import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runJson } from "../../gateway/json";
import { GatewayError } from "../../gateway/errors";
import { writeMarkdown } from "../../store/markdown";
import { readPost, writePost } from "../../store/posts";
import { EnhanceError, enhancePost } from "./enhance";
import { extractFacts, missingFacts } from "./facts";

// Every test runs against a throwaway folder, never the real content/ folder.
vi.mock("../../store/paths", async () => {
  const nodePath = await import("node:path");
  const rootOf = () => (globalThis as { __enhanceTestRoot?: string }).__enhanceTestRoot ?? "";
  return {
    resolveContentPath(relativePath: string) {
      const absolute = nodePath.resolve(rootOf(), relativePath);
      const rel = nodePath.relative(rootOf(), absolute);
      if (rel === "" || rel.startsWith("..") || nodePath.isAbsolute(rel)) {
        throw new Error(`Path is outside content/: ${relativePath}`);
      }
      return absolute;
    },
  };
});

vi.mock("../../gateway/json", () => ({ runJson: vi.fn() }));

const runJsonMock = vi.mocked(runJson);
const POST = "weeks/2026-W48/days/2026-11-24/linkedin.md";
const ORIGINAL = "Our team cut 40% of weekly reports in Mumbai with Ravi Kumar.";

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

function fileOf(rel: string): string {
  return path.join((globalThis as { __enhanceTestRoot?: string }).__enhanceTestRoot ?? "", rel);
}

function modelSays(rewrite: string) {
  runJsonMock.mockResolvedValueOnce({ data: { rewrite }, text: "", model_used: "test" } as never);
}

async function versionFiles(): Promise<string[]> {
  try {
    return await fs.readdir(fileOf("weeks/2026-W48/days/2026-11-24/versions"));
  } catch {
    return [];
  }
}

beforeEach(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "postline-enhance-"));
  (globalThis as { __enhanceTestRoot?: string }).__enhanceTestRoot = root;
  await fs.writeFile(path.join(root, "voice.md"), "Plain, direct, a little dry.\n", "utf8");
  await writePost(POST, frontmatter, ORIGINAL);
  runJsonMock.mockReset();
});

afterEach(async () => {
  const root = (globalThis as { __enhanceTestRoot?: string }).__enhanceTestRoot;
  if (root) await fs.rm(root, { recursive: true, force: true });
});

describe("enhancePost", () => {
  it("saves a rewrite that keeps every number and name, and keeps the old body as a version", async () => {
    modelSays("Our team cut 40% of weekly reports in Mumbai with Ravi Kumar's help. Fast.");

    const result = await enhancePost({ post_path: POST, aim: "sharper-hook" });

    expect(result).toMatchObject({ post_path: POST, facts_preserved: true });
    if (!("previous_path" in result)) throw new Error("expected a saved result");
    expect(result.lint.hard).toEqual([]);

    const saved = await readPost(POST);
    expect(saved.body.trim()).toBe("Our team cut 40% of weekly reports in Mumbai with Ravi Kumar's help. Fast.");

    const versions = await versionFiles();
    expect(versions).toHaveLength(1);
    expect(path.basename(result.previous_path)).toBe(versions[0]);
    const kept = await fs.readFile(fileOf(result.previous_path), "utf8");
    expect(kept.trim()).toBe(ORIGINAL);
  });

  it("does not save and reports the dropped number when a fact is missing", async () => {
    const before = await fs.readFile(fileOf(POST), "utf8");
    modelSays("Our team cut weekly reports in Mumbai with Ravi Kumar.");

    const result = await enhancePost({ post_path: POST, aim: "shorter" });

    expect(result).toEqual({ facts_preserved: false, code: "facts_changed", missing: ["40"] });
    expect(await fs.readFile(fileOf(POST), "utf8")).toBe(before);
    expect(await versionFiles()).toEqual([]);
  });

  it("rejects a bad aim with bad_aim and makes no model call", async () => {
    await expect(enhancePost({ post_path: POST, aim: "funnier" })).rejects.toMatchObject({
      code: "bad_aim",
      status: 400,
    });
    expect(runJsonMock).not.toHaveBeenCalled();
  });

  it("rejects a rewrite over the channel hard max and saves nothing", async () => {
    const before = await fs.readFile(fileOf(POST), "utf8");
    modelSays(`Our team cut 40% of weekly reports in Mumbai with Ravi Kumar. ${"Steady work. ".repeat(250)}`);

    await expect(enhancePost({ post_path: POST, aim: "more-concrete" })).rejects.toMatchObject({
      code: "too_long",
      status: 422,
    });
    expect(await fs.readFile(fileOf(POST), "utf8")).toBe(before);
    expect(await versionFiles()).toEqual([]);
  });

  it("rejects a rewrite that fails the linter and saves nothing", async () => {
    const before = await fs.readFile(fileOf(POST), "utf8");
    modelSays("Our team cut 40% of weekly reports in Mumbai with Ravi Kumar — fast.");

    await expect(enhancePost({ post_path: POST, aim: "warmer" })).rejects.toMatchObject({
      code: "lint_failed",
    });
    expect(await fs.readFile(fileOf(POST), "utf8")).toBe(before);
    expect(await versionFiles()).toEqual([]);
  });

  it("keeps the user's edited text as a version before replacing it", async () => {
    const edited = "Our team cut 40% of weekly reports in Mumbai with Ravi Kumar, quietly.";
    const { frontmatter: fm } = await readPost(POST);
    await writeMarkdown(POST, { data: fm, body: edited });
    modelSays("Our team cut 40% of weekly reports in Mumbai with Ravi Kumar, quickly.");

    const result = await enhancePost({ post_path: POST, aim: "sharper-hook" });

    if (!("previous_path" in result)) throw new Error("expected a saved result");
    const kept = await fs.readFile(fileOf(result.previous_path), "utf8");
    expect(kept.trim()).toBe(edited);
    expect((await readPost(POST)).body.trim()).toBe("Our team cut 40% of weekly reports in Mumbai with Ravi Kumar, quickly.");
  });

  it("returns voice_missing when content/voice.md does not exist", async () => {
    await fs.rm(fileOf("voice.md"));
    await expect(enhancePost({ post_path: POST, aim: "shorter" })).rejects.toMatchObject({
      code: "voice_missing",
    });
    expect(runJsonMock).not.toHaveBeenCalled();
  });

  it("reports the missing key by name only", async () => {
    runJsonMock.mockRejectedValueOnce(
      new GatewayError("missing_key", "OPENROUTER_API_KEY is not set. Add it to .env.local.", {
        key: "OPENROUTER_API_KEY",
      }),
    );

    const err = await enhancePost({ post_path: POST, aim: "shorter" }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(EnhanceError);
    expect(err).toMatchObject({ code: "missing_key", key: "OPENROUTER_API_KEY", status: 503 });
  });
});

describe("fact check", () => {
  it("treats 1,000 and 1000 as the same number", () => {
    expect(missingFacts("Revenue hit 1,000 units.", "Revenue hit 1000 units.")).toEqual([]);
  });

  it("needs a two-word name to stay together", () => {
    expect(missingFacts("Ravi Kumar led it.", "Kumar and Ravi led it.")).toEqual(["Ravi Kumar"]);
  });

  it("does not count a longer number as the shorter one", () => {
    expect(missingFacts("Up 12 points.", "Up 120 points.")).toEqual(["12"]);
  });

  it("lists numbers and names from the body", () => {
    expect(extractFacts("Ravi Kumar cut 40.5% in Mumbai.")).toEqual({
      numbers: ["40.5"],
      names: ["Ravi", "Kumar", "Mumbai", "Ravi Kumar"],
    });
  });
});
