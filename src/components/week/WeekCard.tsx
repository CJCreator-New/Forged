"use client";

import { useState } from "react";
import { writePostAgain } from "./api";
import { CHANNEL_NAME, cardBadges, plainWeekError, type WeekCard as WeekCardData } from "./logic";
import { Notice, type NoticeState } from "./Notice";

type Props = {
  card: WeekCardData;
  onChanged: () => void;
};

const BADGE_CLASS = {
  "must-fix": "border-transparent bg-[var(--error-bg)] text-[var(--error-ink)]",
  stale: "border-transparent bg-[var(--warn-bg)] text-[var(--warn-ink)]",
  review: "border-[var(--rule)] bg-transparent text-[var(--muted)]",
} as const;

export function WeekCard({ card, onChanged }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const badges = cardBadges({
    hardCount: card.hardCount,
    stale: card.stale,
    reviewRequired: card.reviewRequired,
  });

  async function confirmWriteAgain() {
    setBusy(true);
    setNotice(null);
    const result = await writePostAgain(card.path);
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: "error", error: plainWeekError(result.error) });
      return;
    }
    setConfirming(false);
    onChanged();
  }

  return (
    <article
      aria-label={`${CHANNEL_NAME[card.channel]}, ${card.statusLabel}`}
      className={`flex min-w-0 flex-col gap-2 rounded-md border border-[var(--rule)] bg-[var(--surface)] p-2.5 ${
        card.stale ? "border-l-[3px] border-l-[var(--warn-ink)]" : ""
      }`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="text-sm font-semibold leading-5 text-[var(--ink)]">{CHANNEL_NAME[card.channel]}</h3>
        <p className="text-xs font-medium text-[var(--muted)]">{card.statusLabel}</p>
      </div>

      {badges.length > 0 ? (
        <ul className="flex flex-wrap gap-1" aria-label="Warnings">
          {badges.map((badge) => (
            <li
              key={badge.tone}
              className={`rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold leading-4 ${BADGE_CLASS[badge.tone]}`}
            >
              {badge.label}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="break-all text-[0.6875rem] leading-4 text-[var(--caption)]">{card.path}</p>

      {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}

      {confirming ? (
        <div className="flex flex-col gap-2 border-t border-[var(--rule)] pt-2">
          <p className="text-xs leading-5 text-[var(--ink)]">
            This replaces the current text. The old text is kept as a version.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmWriteAgain}
              disabled={busy}
              className="h-8 rounded-md bg-[var(--accent)] px-2.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Writing..." : "Write it again"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="h-8 rounded-md px-2 text-xs font-medium text-[var(--accent)] underline underline-offset-2 disabled:opacity-60"
            >
              Keep the current text
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-auto h-8 self-start rounded-md border border-[var(--rule)] px-2.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--bg)]"
        >
          Write again
        </button>
      )}
    </article>
  );
}
