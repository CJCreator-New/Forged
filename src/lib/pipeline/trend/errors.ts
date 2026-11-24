// Error type for trend search. Callers switch on `code`.
// Messages are plain English and never contain a key value.

export type TrendErrorCode =
  | "missing_key"
  | "bad_query"
  | "brave_cap_reached"
  | "brave_error"
  | "counter_unreadable";

export class TrendError extends Error {
  readonly code: TrendErrorCode;
  readonly key?: string;
  readonly status?: number;

  constructor(
    code: TrendErrorCode,
    message: string,
    extra: { key?: string; status?: number } = {},
  ) {
    super(message);
    this.name = "TrendError";
    this.code = code;
    this.key = extra.key;
    this.status = extra.status;
  }
}
