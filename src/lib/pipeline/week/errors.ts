import { errorResponse } from "../daily/errors";

// Errors for the week pipeline. Other pipelines' errors are passed to the daily error mapper.
export type WeekErrorCode =
  | "bad_request"
  | "not_found"
  | "week_exists"
  | "pillar_exists"
  | "brief_missing"
  | "pillar_missing"
  | "pillar_not_found"
  | "invalid_output";

const STATUS: Record<WeekErrorCode, number> = {
  bad_request: 400,
  not_found: 404,
  week_exists: 409,
  pillar_exists: 409,
  brief_missing: 409,
  pillar_missing: 409,
  pillar_not_found: 404,
  invalid_output: 502,
};

export class WeekError extends Error {
  readonly code: WeekErrorCode;
  readonly status: number;

  constructor(code: WeekErrorCode, message: string) {
    super(message);
    this.name = "WeekError";
    this.code = code;
    this.status = STATUS[code];
  }
}

// Turns any thrown error into the API error shape: { error: { code, message, key? } }.
export function weekErrorResponse(err: unknown): Response {
  if (err instanceof WeekError) {
    return Response.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  return errorResponse(err);
}
