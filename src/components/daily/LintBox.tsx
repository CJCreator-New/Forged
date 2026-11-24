import { sanitizeText } from "./messages";
import type { Lint } from "./api";

type Props = { lint: Lint };

// Hard messages block export and show in red. Soft messages only warn and show in amber.
export function LintBox({ lint }: Props) {
  if (lint.hard.length === 0 && lint.soft.length === 0) {
    return (
      <p className="text-sm text-[#1E5C3A]">No rule problems found.</p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {lint.hard.length > 0 ? (
        <div className="rounded-md border border-[#E3B3AC] bg-[#FBEAE7] px-3 py-2.5 text-sm text-[#7F1D1D]">
          <p className="font-semibold">Must fix before export</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {lint.hard.map((message, index) => (
              <li key={`hard-${index}`} className="break-words">
                {sanitizeText(message)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {lint.soft.length > 0 ? (
        <div className="rounded-md border border-[#E7C98A] bg-[#FFF6DF] px-3 py-2.5 text-sm text-[#6B4300]">
          <p className="font-semibold">Worth a look</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {lint.soft.map((message, index) => (
              <li key={`soft-${index}`} className="break-words">
                {sanitizeText(message)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
