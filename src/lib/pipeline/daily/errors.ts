import { ConfigError } from "../../config/errors";
import { GatewayError } from "../../gateway/errors";
import { StoreError } from "../../store/posts";

// One error type for the daily pipeline. The code is shown to the UI, the message is plain English.
export type DailyErrorCode =
  | "bad_request"
  | "voice_missing"
  | "trend_failed"
  | "not_found"
  | "day_exists"
  | "post_exists"
  | "user_edited"
  | "humanise_off"
  | "length_too_long"
  | "invalid_output";

export class DailyError extends Error {
  readonly code: DailyErrorCode;
  readonly status: number;
  readonly key?: string;

  constructor(code: DailyErrorCode, message: string, extra: { status?: number; key?: string } = {}) {
    super(message);
    this.name = "DailyError";
    this.code = code;
    this.status = extra.status ?? DEFAULT_STATUS[code];
    this.key = extra.key;
  }
}

const DEFAULT_STATUS: Record<DailyErrorCode, number> = {
  bad_request: 400,
  voice_missing: 409,
  trend_failed: 502,
  not_found: 404,
  day_exists: 409,
  post_exists: 409,
  user_edited: 409,
  humanise_off: 409,
  length_too_long: 400,
  invalid_output: 502,
};

const GATEWAY_STATUS: Record<string, number> = {
  missing_key: 412,
  unknown_task: 500,
};

const STORE_STATUS: Record<string, number> = {
  user_edited: 409,
  exists: 409,
  bad_path: 400,
  invalid_post: 500,
};

// Turns any thrown error into the API error shape: { error: { code, message, key? } }.
// Key values never appear here. A missing key is reported by its name only.
export function errorResponse(err: unknown): Response {
  let code = "internal_error";
  let message = "Something went wrong. Try again, and check the terminal if it keeps happening.";
  let status = 500;
  let key: string | undefined;

  if (err instanceof DailyError) {
    code = err.code;
    message = err.message;
    status = err.status;
    key = err.key;
  } else if (err instanceof GatewayError) {
    code = err.code;
    message = err.message;
    status = GATEWAY_STATUS[err.code] ?? 502;
    key = err.key;
  } else if (err instanceof StoreError) {
    code = err.code;
    message = err.message;
    status = STORE_STATUS[err.code] ?? 500;
  } else if (err instanceof ConfigError) {
    code = err.code;
    message = err.message;
    status = 500;
  }

  const body: { code: string; message: string; key?: string } = { code, message };
  if (key) body.key = key;
  return Response.json({ error: body }, { status });
}
