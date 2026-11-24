// Enhance (CONTEXT.md). One explicit user action rewrites one Post for a chosen aim.
// Order: check input, read voice and post, ask the model, fact check, length check, lint, save.
// Nothing is saved unless every check passes. The previous body is kept as a version by the store.
import { promises as fs } from "node:fs";
import { z } from "zod";
import { loadChannels } from "../../config/loaders";
import { GatewayError } from "../../gateway/errors";
import { runJson } from "../../gateway/json";
import { lintText, type LintResult } from "../../linter";
import { resolveContentPath } from "../../store/paths";
import { readPost, replaceGeneratedBody, StoreError } from "../../store/posts";
import { buildEnhanceMessages, isAim, type ChannelSpec } from "./prompt";
import { missingFacts } from "./facts";

export const NOTE_MAX_CHARS = 500;

export type EnhanceErrorCode =
  | "bad_request"
  | "bad_path"
  | "bad_aim"
  | "note_too_long"
  | "voice_missing"
  | "post_not_found"
  | "invalid_post"
  | "empty_post"
  | "too_long"
  | "lint_failed"
  | "missing_key"
  | "model_failed"
  | "internal_error";

export class EnhanceError extends Error {
  readonly code: EnhanceErrorCode;
  readonly status: number;
  readonly key?: string;

  constructor(code: EnhanceErrorCode, status: number, message: string, key?: string) {
    super(message);
    this.name = "EnhanceError";
    this.code = code;
    this.status = status;
    this.key = key;
  }
}

export type EnhanceInput = {
  post_path: unknown;
  aim: unknown;
  note?: unknown;
};

export type EnhanceSaved = {
  post_path: string;
  previous_path: string;
  lint: LintResult;
  facts_preserved: true;
};

export type EnhanceFactsChanged = {
  facts_preserved: false;
  code: "facts_changed";
  missing: string[];
};

export type EnhanceOutcome = EnhanceSaved | EnhanceFactsChanged;

const RewriteSchema = z.object({ rewrite: z.string().min(1) });

function validPostPath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!value.endsWith(".md") || value.endsWith(".raw.md")) return false;
  try {
    resolveContentPath(value);
    return true;
  } catch {
    return false;
  }
}

function isMissingFileError(err: unknown): boolean {
  return (err as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

async function readVoice(): Promise<string> {
  let text: string;
  try {
    text = await fs.readFile(resolveContentPath("voice.md"), "utf8");
  } catch (err) {
    if (isMissingFileError(err)) {
      throw new EnhanceError("voice_missing", 422, "content/voice.md is missing. Set up your voice first.");
    }
    throw err;
  }
  if (text.trim() === "") {
    throw new EnhanceError("voice_missing", 422, "content/voice.md is empty. Set up your voice first.");
  }
  return text;
}

async function loadPost(postPath: string) {
  try {
    return await readPost(postPath);
  } catch (err) {
    if (err instanceof StoreError && err.code === "invalid_post") {
      throw new EnhanceError("invalid_post", 422, err.message);
    }
    if (isMissingFileError(err)) {
      throw new EnhanceError("post_not_found", 404, `Post not found: ${postPath}`);
    }
    throw err;
  }
}

async function askModel(messages: ReturnType<typeof buildEnhanceMessages>): Promise<string> {
  try {
    const result = await runJson("enhance", messages, RewriteSchema);
    return result.data.rewrite.trim();
  } catch (err) {
    if (err instanceof GatewayError) {
      if (err.code === "missing_key") {
        throw new EnhanceError("missing_key", 503, err.message, err.key);
      }
      throw new EnhanceError("model_failed", 502, err.message);
    }
    throw err;
  }
}

export async function enhancePost(input: EnhanceInput): Promise<EnhanceOutcome> {
  if (!validPostPath(input.post_path)) {
    throw new EnhanceError("bad_path", 400, "post_path must be a .md file inside content/.");
  }
  const postPath = input.post_path;
  if (!isAim(input.aim)) {
    throw new EnhanceError("bad_aim", 400, "aim must be one of sharper-hook, more-concrete, shorter, warmer.");
  }
  const aim = input.aim;

  let note: string | undefined;
  if (input.note !== undefined && input.note !== null) {
    if (typeof input.note !== "string") {
      throw new EnhanceError("bad_request", 400, "note must be text.");
    }
    if (input.note.length > NOTE_MAX_CHARS) {
      throw new EnhanceError("note_too_long", 400, `note must be ${NOTE_MAX_CHARS} characters or fewer.`);
    }
    note = input.note;
  }

  const voice = await readVoice();
  const post = await loadPost(postPath);
  if (post.body.trim() === "") {
    throw new EnhanceError("empty_post", 422, "The post has no text to enhance.");
  }

  const channels = loadChannels();
  const channelLimits = channels[post.frontmatter.channel];
  const spec: ChannelSpec = {
    channel: post.frontmatter.channel,
    hookMaxChars: channelLimits.hook_max_chars,
    hardMaxChars: channelLimits.hard_max_chars,
    hashtagMin: channelLimits.hashtags.min,
    hashtagMax: channelLimits.hashtags.max,
  };

  const rewrite = await askModel(buildEnhanceMessages({ voice, spec, body: post.body, aim, note }));

  const missing = missingFacts(post.body, rewrite);
  if (missing.length > 0) {
    return { facts_preserved: false, code: "facts_changed", missing };
  }

  if (rewrite.length > spec.hardMaxChars) {
    throw new EnhanceError(
      "too_long",
      422,
      `The rewrite is ${rewrite.length} characters, over the ${post.frontmatter.channel} hard max of ${spec.hardMaxChars}. Nothing was saved.`,
    );
  }

  const lint = lintText(rewrite, { channel: post.frontmatter.channel, topic: post.frontmatter.topic });
  if (lint.hard.length > 0) {
    throw new EnhanceError("lint_failed", 422, `The rewrite fails the linter: ${lint.hard.join("; ")}. Nothing was saved.`);
  }

  // replaceGeneratedBody keeps the previous body in versions/ before it writes the new one.
  // The user asked for this change explicitly, so force is set (ADR 0007).
  const { versionPath } = await replaceGeneratedBody(postPath, rewrite, { force: true });

  return {
    post_path: postPath,
    previous_path: versionPath,
    lint,
    facts_preserved: true,
  };
}
