import type { Angle } from "@/lib/schemas/ideas";
import { formatLabel } from "./copy";
import { sanitizeText } from "./messages";

type Props = {
  angles: Angle[];
  trendSources: { url: string; title: string }[];
  pickedIndex: number | null;
  busy: boolean;
  onPick: (index: number) => void;
};

export function AnglesList({ angles, trendSources, pickedIndex, busy, onPick }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {trendSources.length > 0 ? (
        <details className="rounded-md border border-[#D6D7D0] bg-[#FBFBF8] px-3 py-2.5 text-sm text-[#1B1F1D]">
          <summary className="cursor-pointer font-medium">
            News used for these angles ({trendSources.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {trendSources.map((source) => (
              <li key={source.url} className="break-words">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1F4E8C] underline underline-offset-2"
                >
                  {sanitizeText(source.title || source.url)}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <ul className="flex flex-col gap-3">
        {angles.map((angle, index) => {
          const picked = pickedIndex === index;
          return (
            <li
              key={`${index}-${angle.title}`}
              className={`flex flex-col gap-3 rounded-md border bg-[#FBFBF8] p-4 ${
                picked ? "border-[#1F4E8C] ring-1 ring-[#1F4E8C]" : "border-[#D6D7D0]"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-base font-semibold leading-6 text-[#1B1F1D] break-words">
                  {sanitizeText(angle.title)}
                </h3>
                <span className="shrink-0 text-sm text-[#5A605C]">{formatLabel(angle.format)}</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium text-[#5A605C]">Possible openings</p>
                <ul className="flex flex-col gap-1.5">
                  {angle.hooks.map((hook, hookIndex) => (
                    <li
                      key={`hook-${hookIndex}`}
                      className="border-l-2 border-[#CFD0C8] pl-3 text-[15px] leading-6 text-[#1B1F1D] break-words"
                    >
                      {sanitizeText(hook)}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-sm leading-6 text-[#4A504C] break-words">
                <span className="font-medium text-[#1B1F1D]">Why it could travel: </span>
                {sanitizeText(angle.why_it_could_travel)}
              </p>

              {angle.source_urls.length > 0 ? (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {angle.source_urls.map((url) => (
                    <li key={url} className="min-w-0 break-all">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#1F4E8C] underline underline-offset-2"
                      >
                        Source
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPick(index)}
                  className={`inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F4E8C] ${
                    picked
                      ? "bg-[#1B1F1D] text-white"
                      : "border border-[#1B1F1D] text-[#1B1F1D] hover:bg-[#E8E9E3]"
                  }`}
                >
                  {picked && busy ? "Writing posts..." : picked ? "Chosen for today" : "Use this angle"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
