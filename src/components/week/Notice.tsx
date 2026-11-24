import type { WeekPlainError } from "./logic";

export type NoticeState =
  | { tone: "error"; error: WeekPlainError }
  | { tone: "info"; title: string; detail?: string };

type Props = {
  notice: NoticeState;
  onDismiss: () => void;
  onReplaceWeek?: () => void;
};

// One place for every message the Week page shows about a step.
export function Notice({ notice, onDismiss, onReplaceWeek }: Props) {
  const isError = notice.tone === "error";
  const title = isError ? notice.error.title : notice.title;
  const detail = isError ? notice.error.detail : notice.detail;
  const offerReplace = isError && notice.error.action === "replace_week" && onReplaceWeek;

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex min-w-0 flex-col gap-1.5 rounded-md border px-3 py-2 text-sm leading-6 break-words ${
        isError
          ? "border-[#E3B3AC] bg-[var(--error-bg)] text-[var(--error-ink)]"
          : "border-[var(--rule)] bg-[var(--accent-soft)] text-[var(--ink)]"
      }`}
    >
      <p className="font-semibold">{title}</p>
      {detail ? <p>{detail}</p> : null}
      <div className="flex flex-wrap gap-3 pt-0.5">
        {offerReplace ? (
          <button type="button" onClick={onReplaceWeek} className="font-semibold underline underline-offset-2">
            Replace this week
          </button>
        ) : null}
        <button type="button" onClick={onDismiss} className="font-medium underline underline-offset-2">
          Dismiss
        </button>
      </div>
    </div>
  );
}
