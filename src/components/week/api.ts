// Fetch wrappers for the Week page. Every call returns a result object and never throws.
import { dayPathOf } from "./logic";
import type {
  AdaptResponse,
  ApiError,
  BuildPillarResponse,
  Brief,
  CreateWeekRequest,
  CreateWeekResponse,
  DraftResponse,
  PillarBodyResponse,
  PostFrontmatterResponse,
  SavePillarResponse,
  WeekViewResponse,
} from "./types";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiError };

function readError(body: unknown, status: number): ApiError {
  if (body && typeof body === "object" && "error" in body) {
    const inner = (body as { error: unknown }).error;
    if (inner && typeof inner === "object") {
      const { code, message, key } = inner as Record<string, unknown>;
      if (typeof code === "string") {
        return {
          code,
          message: typeof message === "string" ? message : "",
          key: typeof key === "string" ? key : undefined,
        };
      }
    }
  }
  return { code: `http_${status}`, message: "" };
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

const NETWORK_ERROR: ApiError = {
  code: "network",
  message: "The app could not reach its local server. Check that it is running.",
};

async function send<T>(path: string, init: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, cache: "no-store" });
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }
  const body = await safeJson(res);
  if (!res.ok) return { ok: false, status: res.status, error: readError(body, res.status) };
  return { ok: true, data: body as T };
}

function postJson<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  return send<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function putJson<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  return send<T>(path, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getWeekView(weekId: string): Promise<ApiResult<WeekViewResponse>> {
  return send<WeekViewResponse>(`/api/week/view?week=${encodeURIComponent(weekId)}`, { method: "GET" });
}

export function createWeek(brief: Brief, weekId: string, replace = false): Promise<ApiResult<CreateWeekResponse>> {
  const body: CreateWeekRequest = replace ? { brief, week: weekId, replace: true } : { brief, week: weekId };
  return postJson<CreateWeekResponse>("/api/week", body);
}

export function buildPillar(weekPath: string): Promise<ApiResult<BuildPillarResponse>> {
  return postJson<BuildPillarResponse>("/api/pillar", { week_path: weekPath });
}

export function getPillar(weekId: string): Promise<ApiResult<PillarBodyResponse>> {
  return send<PillarBodyResponse>(`/api/pillar?week=${encodeURIComponent(weekId)}`, { method: "GET" });
}

export function savePillar(weekPath: string, body: string): Promise<ApiResult<SavePillarResponse>> {
  return putJson<SavePillarResponse>("/api/pillar", { week_path: weekPath, body });
}

export function adaptWeek(weekPath: string): Promise<ApiResult<AdaptResponse>> {
  return postJson<AdaptResponse>("/api/week/adapt", { week_path: weekPath });
}

// Writes one post again with the settings it was first written with, read from its own frontmatter.
export async function writePostAgain(postPath: string): Promise<ApiResult<DraftResponse>> {
  const dayPath = dayPathOf(postPath);
  if (dayPath === null) {
    return { ok: false, status: 400, error: { code: "bad_path", message: "" } };
  }
  const current = await send<PostFrontmatterResponse>(`/api/post?path=${encodeURIComponent(postPath)}`, {
    method: "GET",
  });
  if (!current.ok) return current;
  const fm = current.data.frontmatter;
  return postJson<DraftResponse>("/api/draft", {
    day_path: dayPath,
    channel: fm.channel,
    length: fm.length,
    ...(fm.custom_target !== undefined ? { custom_target: fm.custom_target } : {}),
    style: fm.style,
    humanise: fm.humanise,
  });
}

// Downloads the week ZIP. A failed export returns the server's plain error, never a raw response.
export async function downloadWeekZip(weekId: string): Promise<ApiResult<{ filename: string }>> {
  let res: Response;
  try {
    res = await fetch(`/api/export/week?week=${encodeURIComponent(weekId)}`, { cache: "no-store" });
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }
  if (!res.ok) {
    const body = await safeJson(res);
    return { ok: false, status: res.status, error: readError(body, res.status) };
  }
  const blob = await res.blob();
  const filename = filenameFrom(res.headers.get("content-disposition")) ?? `postline-${weekId}.zip`;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
  return { ok: true, data: { filename } };
}

function filenameFrom(disposition: string | null): string | null {
  if (!disposition) return null;
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return match ? match[1] : null;
}
