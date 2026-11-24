import type { PlainError } from "./messages";

export type NoticeState =
  | { tone: "error"; error: PlainError }
  | { tone: "info"; title: string; detail?: string };

type Props = {
  notice: NoticeState;
  onDismiss: () => void;
  onTurnTrendOff?: () => void;
};

// One place for every message the user sees about a failed or finished step.
export function Notice({ notice, onDismiss, onTurnTrendOff }: Props) {
  const isError = notice.tone === "error";
  const title = isError ? notice.error.title : notice.title;
  const detail = isError ? notice.error.detail : notice.detail;
  const showTrendAction = isError && notice.error.action === "turn_trend_off" && onTurnTrendOff;

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex flex-col gap-2 rounded-md border px-3 py-2.5 text-sm leading-6 break-words ${
        isError
          ? "border-[#E3B3AC] bg-[#FBEAE7] text-[#7F1D1D]"
          : "border-[#C9D6E8] bg-[#EEF3FA] text-[#1B3A63]"
      }`}
    >
      <p className="font-semibold">{title}</p>
      {detail ? <p>{detail}</p> : null}
      <div className="flex flex-wrap gap-3 pt-0.5">
        {showTrendAction ? (
          <button
            type="button"
            onClick={onTurnTrendOff}
            className="font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4E8C]"
          >
            Turn off search for recent news
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          className="font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4E8C]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
