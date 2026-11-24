// Shared error responses for the settings routes. Uses the contract shape:
// { error: { code, message, key? } }. Messages are plain English and never hold a key value.
import { GatewayError } from "../../lib/gateway/errors";

export function errorJson(status: number, code: string, message: string, key?: string): Response {
  const body = key ? { error: { code, message, key } } : { error: { code, message } };
  return Response.json(body, { status });
}

// Maps a gateway failure to an HTTP response. Anything unknown becomes a generic 500.
export function gatewayErrorResponse(err: unknown): Response {
  if (err instanceof GatewayError) {
    switch (err.code) {
      case "missing_key":
        return errorJson(400, "missing_key", err.message, err.key);
      case "rate_limited":
        return errorJson(429, "rate_limited", err.message);
      case "timeout":
      case "network_error":
      case "provider_error":
        return errorJson(502, err.code, err.message);
      default:
        return errorJson(500, err.code, err.message);
    }
  }
  return errorJson(500, "unexpected_error", "Something went wrong. Try again.");
}
