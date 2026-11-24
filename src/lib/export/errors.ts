import { StoreError } from "../store/posts";

export type ExportErrorCode =
  | "bad_request"
  | "bad_path"
  | "bad_week"
  | "not_found"
  | "invalid_post"
  | "invalid_deck"
  | "hard_lint_failed"
  | "review_required"
  | "not_rendered"
  | "export_failed";

const STATUS: Record<ExportErrorCode, number> = {
  bad_request: 400,
  bad_path: 400,
  bad_week: 400,
  not_found: 404,
  invalid_post: 422,
  invalid_deck: 422,
  hard_lint_failed: 422,
  review_required: 409,
  not_rendered: 409,
  export_failed: 500,
};

// Messages must never contain absolute machine paths. Use content-relative paths only.
export class ExportError extends Error {
  readonly code: ExportErrorCode;
  readonly status: number;
  constructor(code: ExportErrorCode, message: string) {
    super(message);
    this.name = "ExportError";
    this.code = code;
    this.status = STATUS[code];
  }
}

// Turns any thrown value into the { error: { code, message } } shape. Unknown errors get a generic message.
export function errorResponse(err: unknown): Response {
  if (err instanceof ExportError) {
    return Response.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  if (err instanceof StoreError) {
    const code = err.code === "bad_path" ? "bad_path" : "invalid_post";
    return Response.json({ error: { code, message: err.message } }, { status: STATUS[code] });
  }
  return Response.json(
    { error: { code: "export_failed", message: "The export could not be completed." } },
    { status: 500 },
  );
}
