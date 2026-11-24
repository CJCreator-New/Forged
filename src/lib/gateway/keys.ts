import { GatewayError } from "./errors";

export const OPENROUTER_KEY_NAME = "OPENROUTER_API_KEY";

// The key value is returned only so the caller can put it in the Authorization header.
// Never log it, never return it to the browser (ADR 0004).
export function getOpenRouterKey(): string {
  const value = process.env[OPENROUTER_KEY_NAME];
  if (!value || value.trim() === "") {
    throw new GatewayError(
      "missing_key",
      `${OPENROUTER_KEY_NAME} is not set. Add it to .env.local.`,
      { key: OPENROUTER_KEY_NAME },
    );
  }
  return value.trim();
}
