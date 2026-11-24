"use client";

import { useId } from "react";

type Props = {
  topic: string;
  onTopicChange: (value: string) => void;
  trend: boolean;
  onTrendChange: (value: boolean) => void;
  busy: boolean;
  onSubmit: () => void;
};

export function TopicForm({ topic, onTopicChange, trend, onTrendChange, busy, onSubmit }: Props) {
  const topicId = useId();
  const trendId = useId();
  const canSubmit = topic.trim().length > 0 && !busy;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={topicId} className="text-sm font-medium text-[#1B1F1D]">
          What is today&apos;s topic?
        </label>
        <textarea
          id={topicId}
          value={topic}
          onChange={(event) => onTopicChange(event.target.value)}
          rows={2}
          placeholder="A rough thought is fine. One line is enough."
          className="w-full resize-y rounded-md border border-[#CFD0C8] bg-[#FBFBF8] px-3 py-2 text-[15px] leading-6 text-[#1B1F1D] placeholder:text-[#8A8F8B] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1F4E8C]"
        />
      </div>

      <div className="flex items-start justify-between gap-4 rounded-md border border-[#D6D7D0] bg-[#FBFBF8] px-3 py-3">
        <div className="flex flex-col gap-0.5">
          <label htmlFor={trendId} className="text-sm font-medium text-[#1B1F1D]">
            Search for recent news
          </label>
          <p className="text-sm leading-5 text-[#5A605C]">
            Adds current stories to the angles. Off by default to save searches.
          </p>
        </div>
        <button
          id={trendId}
          type="button"
          role="switch"
          aria-checked={trend}
          onClick={() => onTrendChange(!trend)}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4E8C] ${
            trend ? "bg-[#1F4E8C]" : "bg-[#B9BCB5]"
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
              trend ? "translate-x-5" : "translate-x-0"
            }`}
          />
          <span className="sr-only">{trend ? "On" : "Off"}</span>
        </button>
      </div>

      <div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-11 items-center justify-center rounded-md bg-[#1F4E8C] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#173C6C] disabled:cursor-not-allowed disabled:bg-[#B9BCB5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4E8C]"
        >
          {busy ? "Finding angles..." : "Get angles"}
        </button>
      </div>
    </form>
  );
}
