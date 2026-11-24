// Pure helpers for the Daily page. No React here, so they can be tested directly.

export type ApiError = {
  code: string;
  message: string;
  key?: string;
};

export type PlainError = {
  title: string;
  detail: string;
  // Extra action the UI can offer under the message.
  action: "turn_trend_off" | "none";
};

// Replaces em dashes and en dashes so no visible text carries them.
export function sanitizeText(text: string): string {
  return text.replace(/\s*[\u2014\u2013]\s*/g, ", ").trim();
}

// Turns an API error into plain English. Never shows the raw error object or any key value.
export function plainError(error: ApiError): PlainError {
  const serverMessage = usableMessage(error.message);

  switch (error.code) {
    case "missing_key": {
      const name = error.key ? sanitizeText(error.key) : "a model key";
      return {
        title: "A key is missing",
        detail: `Set ${name} in your local settings file, then restart the app.`,
        action: "none",
      };
    }
    case "voice_missing":
      return {
        title: "Your voice file is missing",
        detail: "Create your voice file at content/voice.md, then try again.",
        action: "none",
      };
    case "trend_failed":
      return {
        title: "The news search failed",
        detail: serverMessage
          ? `${serverMessage}. Turn off "Search for recent news" to carry on without it.`
          : 'Turn off "Search for recent news" to carry on without it.',
        action: "turn_trend_off",
      };
    case "trend_cap_reached":
    case "trend_cap":
      return {
        title: "Monthly news search limit reached",
        detail: 'You have used all 900 news searches this month. Turn off "Search for recent news" to carry on.',
        action: "turn_trend_off",
      };
    case "hard_lint_failed":
      return {
        title: "Fix these before you export",
        detail: serverMessage || "This post has rules it breaks. Fix the red messages, then export.",
        action: "none",
      };
    case "review_required":
      return {
        title: "Review needed before export",
        detail: "This post needs a manual check. Tick the review box to confirm it, then export.",
        action: "none",
      };
    case "user_edited":
      return {
        title: "You have edited this post",
        detail: "Running this again would replace your edits. Copy your edits somewhere safe first.",
        action: "none",
      };
    case "facts_changed":
      return {
        title: "The new version changed some facts",
        detail: serverMessage
          ? `Facts missing from the new version: ${serverMessage}`
          : "Some facts from your post are missing from the new version. Check the text before you use it.",
        action: "none",
      };
    default:
      return {
        title: "Something went wrong",
        detail: serverMessage || "Try again. If it keeps happening, check that the app is still running.",
        action: "none",
      };
  }
}

// A message is only shown if it reads as a sentence. JSON or empty text is dropped.
export function usableMessage(message: string | undefined): string {
  if (!message) return "";
  const cleaned = sanitizeText(message);
  if (cleaned.length === 0) return "";
  if (cleaned.startsWith("{") || cleaned.startsWith("[")) return "";
  return cleaned;
}

// Reads the error shape { error: { code, message, key? } } from an unknown JSON body.
export function readApiError(body: unknown, status: number): ApiError {
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
  return {
    code: `http_${status}`,
    message: "The app could not complete that step.",
  };
}
