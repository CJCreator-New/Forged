"use client";

import { useId, useMemo, useState } from "react";
import { savePillar } from "./api";
import {
  countSourceMarkers,
  countWords,
  highlightSegments,
  plainWeekError,
  staleMessage,
} from "./logic";
import { Notice, type NoticeState } from "./Notice";

type Props = {
  weekPath: string;
  initialBody: string;
  onSaved: () => void;
};

// The long-form draft. Saving marks adapted posts as Needs a fresh write. It never rewrites a post.
export function PillarPanel({ weekPath, initialBody, onSaved }: Props) {
  const textId = useId();
  const [text, setText] = useState(initialBody);
  const [saved, setSaved] = useState(initialBody);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const words = countWords(text);
  const markers = countSourceMarkers(text);
  const segments = useMemo(() => highlightSegments(text), [text]);
  const dirty = text !== saved;

  async function save() {
    setBusy(true);
    setNotice(null);
    setMessage(null);
    const result = await savePillar(weekPath, text);
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: "error", error: plainWeekError(result.error) });
      return;
    }
    setSaved(text);
    setMessage(staleMessage(result.data.stale_posts.length));
    onSaved();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <label htmlFor={textId} className="text-sm font-medium">
          Long-form draft
        </label>
        <p className="text-sm tabular-nums text-[var(--muted)]">
          {words} {words === 1 ? "word" : "words"}
          {markers > 0 ? `, ${markers} ${markers === 1 ? "source" : "sources"} to add` : ""}
        </p>
      </div>

      <textarea
        id={textId}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setMessage(null);
        }}
        rows={14}
        className="w-full min-w-0 rounded-md border border-[#b9c6c2] bg-[var(--surface)] px-3 py-2.5 leading-7 text-[var(--ink)]"
      />

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">Highlighted view</p>
        <div className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-[var(--rule)] bg-[var(--bg)] px-3 py-2.5 text-sm leading-7 text-[var(--ink)]">
          {segments.length === 0 ? (
            <span className="text-[var(--muted)]">Nothing here yet.</span>
          ) : (
            segments.map((segment, index) =>
              segment.marker ? (
                <mark
                  key={index}
                  className="rounded-sm bg-[var(--warn-bg)] px-0.5 font-semibold text-[var(--warn-ink)]"
                >
                  {segment.text}
                </mark>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )
          )}
        </div>
      </div>

      {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}
      {message ? (
        <p role="status" className="text-sm text-[var(--ok-ink)]">
          {message}
        </p>
      ) : null}

      <div>
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="h-10 rounded-md border border-[var(--ink)] px-4 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save the draft"}
        </button>
      </div>
    </div>
  );
}
