"use client";

import { useId, useState, type FormEvent } from "react";
import { createWeek } from "./api";
import { parseKeyPoints, plainWeekError, validateBrief } from "./logic";
import { Notice, type NoticeState } from "./Notice";
import type { Brief } from "./types";

type Props = {
  weekId: string;
  onCreated: () => void;
};

const FIELD_CLASS =
  "w-full min-w-0 rounded-md border border-[#b9c6c2] bg-[var(--surface)] px-2.5 py-2 text-[var(--ink)]";

// The campaign brief. Creates the week, then the parent reloads the view.
export function BriefForm({ weekId, onCreated }: Props) {
  const goalId = useId();
  const audienceId = useId();
  const pointsId = useId();
  const ctaId = useId();
  const linkId = useId();

  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [callToAction, setCallToAction] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  async function send(replace: boolean) {
    const brief: Brief = {
      goal: goal.trim(),
      audience: audience.trim(),
      key_points: parseKeyPoints(keyPoints),
      call_to_action: callToAction.trim(),
      ...(link.trim() !== "" ? { link: link.trim() } : {}),
    };
    setBusy(true);
    setNotice(null);
    const result = await createWeek(brief, weekId, replace);
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: "error", error: plainWeekError(result.error) });
      return;
    }
    setNotice({ tone: "info", title: "The week is set up.", detail: "Build the long-form draft next." });
    onCreated();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateBrief({ goal, audience, keyPointsText: keyPoints, callToAction, link });
    setProblems(found);
    if (found.length > 0) return;
    send(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={goalId} className="text-sm font-medium">
            Goal
          </label>
          <input
            id={goalId}
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="What should this week achieve?"
            className={`h-10 ${FIELD_CLASS}`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={audienceId} className="text-sm font-medium">
            Audience
          </label>
          <input
            id={audienceId}
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
            placeholder="Who are the posts for?"
            className={`h-10 ${FIELD_CLASS}`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={pointsId} className="text-sm font-medium">
          Key points
        </label>
        <p className="text-sm text-[var(--muted)]">One point per line.</p>
        <textarea
          id={pointsId}
          value={keyPoints}
          onChange={(event) => setKeyPoints(event.target.value)}
          rows={4}
          className={FIELD_CLASS}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ctaId} className="text-sm font-medium">
            Call to action
          </label>
          <input
            id={ctaId}
            value={callToAction}
            onChange={(event) => setCallToAction(event.target.value)}
            placeholder="What should the reader do next?"
            className={`h-10 ${FIELD_CLASS}`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={linkId} className="text-sm font-medium">
            Link <span className="font-normal text-[var(--muted)]">(optional)</span>
          </label>
          <input
            id={linkId}
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://"
            inputMode="url"
            className={`h-10 ${FIELD_CLASS}`}
          />
        </div>
      </div>

      {problems.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-[var(--error-ink)]" role="alert">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}

      {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} onReplaceWeek={() => send(true)} /> : null}

      <div>
        <button
          type="submit"
          disabled={busy}
          className="h-10 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Setting up the week..." : "Save the campaign brief"}
        </button>
      </div>
    </form>
  );
}
