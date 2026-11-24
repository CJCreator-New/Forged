"use client";

import { useEffect, useState } from "react";
import { readPostText, type Lint } from "./api";
import { LintBox } from "./LintBox";
import { buttonPrimary, buttonSecondary } from "./ui";

export type VariantItem = {
  variant_index: number;
  path: string;
  lint: Lint;
};

type Props = {
  variants: VariantItem[];
  busy: boolean;
  onUse: (variantIndex: number) => void;
};

// Shows each opening side by side with its own lint result, so the user can pick quickly.
export function VariantCompare({ variants, busy, onUse }: Props) {
  const [texts, setTexts] = useState<Record<number, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    variants.forEach((variant) => {
      readPostText(variant.path).then((result) => {
        if (cancelled) return;
        setTexts((current) => ({
          ...current,
          [variant.variant_index]: result.ok ? result.data.body : null,
        }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [variants]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[#5A605C]">
        Same facts, different openings. Pick the one you want to keep. The others are saved for later.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {variants.map((variant) => {
          const text = texts[variant.variant_index];
          return (
            <article
              key={variant.variant_index}
              className="flex min-w-0 flex-col gap-3 rounded-md border border-[#D6D7D0] bg-white p-3.5"
            >
              <h4 className="text-sm font-semibold text-[#1B1F1D]">Opening {variant.variant_index}</h4>
              {text === undefined ? (
                <p className="text-sm text-[#5A605C]">Loading text...</p>
              ) : text === null ? (
                <p className="text-sm text-[#7F1D1D]">This opening could not be loaded.</p>
              ) : (
                <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#1B1F1D] break-words">
                  {text}
                </p>
              )}
              <LintBox lint={variant.lint} />
              <div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onUse(variant.variant_index)}
                  className={variant.lint.hard.length > 0 ? buttonSecondary : buttonPrimary}
                >
                  Use this opening
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
