import type { ZodType, z } from "zod";
import { ConfigError } from "../../config/errors";
import { GatewayError } from "../../gateway/errors";
import { StoreError } from "../../store/posts";

// One error type for every deck, render, logo and icon route. The route turns it into the contract's error shape.
export class RouteError extends Error {
  readonly status: number;
  readonly code: string;
  readonly key?: string;

  constructor(status: number, code: string, message: string, key?: string) {
    super(message);
    this.name = "RouteError";
    this.status = status;
    this.code = code;
    this.key = key;
  }
}

export type IssueLike = { path: PropertyKey[]; message: string };

// Turns zod issues into one plain sentence, e.g. "slides.0.title: Too big".
export function issuesText(issues: readonly IssueLike[]): string {
  return issues.map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`).join("; ");
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new RouteError(400, "bad_request", "The request body must be JSON.");
  }
}

export function parseBody<S extends ZodType>(schema: S, raw: unknown): z.output<S> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new RouteError(400, "bad_request", issuesText(result.error.issues));
  }
  return result.data as z.output<S>;
}

export function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as NodeJS.ErrnoException).code === "ENOENT";
}

// Maps any thrown error to a JSON response. Messages never contain key values.
export function toResponse(err: unknown): Response {
  if (err instanceof RouteError) {
    return Response.json(
      { error: { code: err.code, message: err.message, ...(err.key ? { key: err.key } : {}) } },
      { status: err.status },
    );
  }
  if (err instanceof StoreError) {
    const status = err.code === "exists" ? 409 : err.code === "bad_path" ? 400 : 422;
    return Response.json({ error: { code: err.code, message: err.message } }, { status });
  }
  if (err instanceof GatewayError) {
    const status = err.code === "missing_key" ? 400 : 502;
    return Response.json(
      { error: { code: err.code, message: err.message, ...(err.key ? { key: err.key } : {}) } },
      { status },
    );
  }
  if (err instanceof ConfigError) {
    return Response.json({ error: { code: "config_invalid", message: err.message } }, { status: 500 });
  }
  const message = err instanceof Error ? err.message : "Something went wrong.";
  return Response.json({ error: { code: "internal_error", message } }, { status: 500 });
}
