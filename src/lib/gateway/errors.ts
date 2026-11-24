// One error type for every gateway failure. Callers switch on `code`.
// Messages are plain English and never contain a key value.

export type GatewayErrorCode =
  | "missing_key"
  | "rate_limited"
  | "timeout"
  | "network_error"
  | "provider_error"
  | "invalid_output"
  | "unknown_task"
  | "all_models_failed";

export class GatewayError extends Error {
  readonly code: GatewayErrorCode;
  readonly key?: string;
  readonly status?: number;

  constructor(
    code: GatewayErrorCode,
    message: string,
    extra: { key?: string; status?: number } = {},
  ) {
    super(message);
    this.name = "GatewayError";
    this.code = code;
    this.key = extra.key;
    this.status = extra.status;
  }
}
