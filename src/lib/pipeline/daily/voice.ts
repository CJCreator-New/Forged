import { promises as fs } from "node:fs";
import { resolveContentPath } from "../../store/paths";
import { DailyError } from "./errors";

export const VOICE_FILE = "voice.md";

// Reads the voice profile fresh on every call (ADR, decisions). Never writes to it.
export async function readVoice(relPath: string = VOICE_FILE): Promise<string> {
  let text: string;
  try {
    text = await fs.readFile(resolveContentPath(relPath), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw voiceMissing();
    throw err;
  }
  const trimmed = text.trim();
  if (trimmed === "") throw voiceMissing();
  return trimmed;
}

function voiceMissing(): DailyError {
  return new DailyError(
    "voice_missing",
    "Your voice profile is missing or empty. Create content/voice.md with your tone, sentence style, words to use, and words to avoid, then try again.",
  );
}
