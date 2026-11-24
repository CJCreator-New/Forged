// Error type for config problems. Carries a short machine code plus the detail fields
// that the caller can show or match on, e.g. { code: "unknown_style", id: "nope" }.
export class ConfigError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ConfigError";
    this.code = code;
    this.details = details;
    Object.assign(this, details);
  }
}
