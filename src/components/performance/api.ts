// Reads the { error: { message } } shape the performance routes send back.
export async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export const INPUT_CLASS =
  "h-10 w-full min-w-0 rounded-md border border-[#b9c6c2] bg-[var(--surface)] px-2.5 text-[1rem] text-[var(--ink)]";

export const SMALL_INPUT_CLASS =
  "h-9 w-24 min-w-0 rounded-md border border-[#b9c6c2] bg-[var(--surface)] px-2 text-[1rem] text-[var(--ink)]";

export const SECONDARY_BUTTON_CLASS =
  "rounded-md border border-[#b9c6c2] bg-[var(--surface)] px-3.5 py-2 text-[var(--ink)] disabled:opacity-60";
