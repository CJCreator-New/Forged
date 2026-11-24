"use client";

import { useState } from "react";
import { errorMessage, SECONDARY_BUTTON_CLASS } from "./api";
import { RESET_CONFIRM_TEXT } from "./view";

// Clears reach and follower numbers only. Posts stay. Two steps, so one click cannot do it.
export default function ResetNumbers({ disabled, onCleared }: { disabled: boolean; onCleared: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function clear() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/perf", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) {
        setError(await errorMessage(res, "The numbers were not cleared."));
        return;
      }
      setConfirming(false);
      onCleared();
    } catch {
      setError("Could not reach the app. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        <div>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={disabled}
            onClick={() => setConfirming(true)}
          >
            Clear reach and follower numbers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--rule)] bg-[var(--surface)] p-4">
      <p className="m-0 max-w-[68ch]">{RESET_CONFIRM_TEXT}</p>
      {error ? (
        <p className="notice notice-error m-0" role="alert">{error}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="button" disabled={busy} onClick={clear}>
          {busy ? "Clearing" : "Clear the numbers"}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => setConfirming(false)}
        >
          Keep the numbers
        </button>
      </div>
    </div>
  );
}
