// Thin fetch wrappers for the Daily page. Every call returns a result object, never throws.
import type { Angle } from "@/lib/schemas/ideas";
import type { PostFrontmatter } from "@/lib/schemas/post";
import { readApiError, type ApiError } from "./messages";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export type Lint = { hard: string[]; soft: string[] };

export type SettingsResponse = {
  switches: {
    trend_mode?: boolean;
    humanise?: boolean;
    variants?: number;
  };
};

export type IdeasResponse = {
  idea_file: string;
  angles: Angle[];
  trend_sources?: { url: string; title: string }[];
};

export type PickResponse = { day_path: string; posts: PostFrontmatter[] };
export type DraftResponse = { post_path: string; lint: Lint };
export type VariantsResponse = {
  variants: { variant_index: number; path: string; lint: Lint }[];
};
export type SelectVariantResponse = { post_path: string };
export type EnhanceResponse = {
  post_path: string;
  previous_path: string;
  lint: Lint;
  facts_preserved: boolean;
};
export type LintResponse = Lint;
export type LengthResponse = { post_path: string; previous_path: string };
export type HumaniseResponse = { post_path: string; raw_path: string };
export type PostTextResponse = { body: string };

export async function postJson<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  return request<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function getJson<T>(path: string): Promise<ApiResult<T>> {
  return request<T>(path, { method: "GET" });
}

// Reads the saved text of one post or variant file.
export function readPostText(path: string): Promise<ApiResult<PostTextResponse>> {
  return getJson<PostTextResponse>(`/api/post?path=${encodeURIComponent(path)}`);
}

// Downloads an export file. Returns an error result when the server sends back an error instead.
export async function downloadExport(url: string): Promise<ApiResult<{ filename: string }>> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    return networkFailure();
  }
  if (!res.ok) {
    const body = await safeJson(res);
    return { ok: false, error: readApiError(body, res.status) };
  }
  const blob = await res.blob();
  const filename = filenameFrom(res.headers.get("content-disposition")) ?? "post.md";
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
  return { ok: true, data: { filename } };
}

async function request<T>(path: string, init: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, cache: "no-store" });
  } catch {
    return networkFailure();
  }
  const body = await safeJson(res);
  if (!res.ok) {
    return { ok: false, error: readApiError(body, res.status) };
  }
  return { ok: true, data: body as T };
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function networkFailure(): ApiResult<never> {
  return {
    ok: false,
    error: { code: "network", message: "The app could not reach its local server. Check that it is running." },
  };
}

function filenameFrom(disposition: string | null): string | null {
  if (!disposition) return null;
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return match ? match[1] : null;
}
