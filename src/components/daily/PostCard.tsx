"use client";

import { useEffect, useId, useState } from "react";
import type { Channel } from "@/lib/schemas/post";
import {
  downloadExport,
  postJson,
  readPostText,
  type ApiResult,
  type EnhanceResponse,
  type HumaniseResponse,
  type Lint,
  type LengthResponse,
  type LintResponse,
  type SelectVariantResponse,
  type VariantsResponse,
} from "./api";
import {
  CHANNEL_LABEL,
  ENHANCE_AIMS,
  LENGTH_OPTIONS,
  STYLE_OPTIONS,
  formatLabel,
  statusLabel,
  type LengthValue,
} from "./copy";
import { LintBox } from "./LintBox";
import { Notice, type NoticeState } from "./Notice";
import { plainError, sanitizeText, type ApiError } from "./messages";
import { VariantCompare, type VariantItem } from "./VariantCompare";
import {
  buttonPrimary,
  buttonQuiet,
  buttonSecondary,
  cardSurface,
  fieldLabel,
  fieldSelect,
  focusRing,
} from "./ui";

export type DraftedPost = {
  channel: Channel;
  postPath: string;
  format: "text" | "carousel";
  style: string;
  length: LengthValue;
  reviewRequired: boolean;
  lint: Lint;
  humanised: boolean;
  // Goes up by one every time the body changes, so the card reloads its text.
  revision: number;
};

type Compare = {
  button: string;
  heading: string;
  path: string;
};

type Props = {
  post: DraftedPost;
  variantCount: 2 | 3;
  onPatch: (channel: Channel, patch: Partial<DraftedPost>) => void;
  onRedraft: (channel: Channel, change: { style: string; length: LengthValue }) => Promise<ApiResult<unknown>>;
};

export function PostCard({ post, variantCount, onPatch, onRedraft }: Props) {
  const headingId = useId();
  const customId = useId();
  const enhanceNoteId = useId();

  const [body, setBody] = useState<string | null | undefined>(undefined);
  const [texts, setTexts] = useState<Record<string, string | null>>({});
  const [compare, setCompare] = useState<Compare | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [pendingCustom, setPendingCustom] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [enhanceNote, setEnhanceNote] = useState("");
  const [factsKept, setFactsKept] = useState<boolean | null>(null);
  const [variants, setVariants] = useState<VariantItem[] | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);

  // Reload the saved text whenever the body changes.
  useEffect(() => {
    let cancelled = false;
    readPostText(post.postPath).then((result) => {
      if (!cancelled) setBody(result.ok ? result.data.body : null);
    });
    return () => {
      cancelled = true;
    };
  }, [post.postPath, post.revision]);

  // Load the comparison text only when the user opens it.
  const comparePath = showCompare && compare ? compare.path : null;
  useEffect(() => {
    if (!comparePath) return;
    let cancelled = false;
    readPostText(comparePath).then((result) => {
      if (!cancelled) setTexts((current) => ({ ...current, [comparePath]: result.ok ? result.data.body : null }));
    });
    return () => {
      cancelled = true;
    };
  }, [comparePath]);

  const channel = post.channel;
  const hasHard = post.lint.hard.length > 0;
  const needsReview = post.reviewRequired && !reviewConfirmed;
  const exportBlockedReason = hasHard
    ? "Export is off until the red messages are fixed."
    : needsReview
      ? "Tick the review box to confirm this post before you export."
      : null;
  const isBusy = busy !== null;

  function showError(error: ApiError) {
    setNotice({ tone: "error", error: plainError(error) });
    if (error.code === "review_required") {
      onPatch(channel, { reviewRequired: true });
    }
  }

  // Runs one API step with a busy label and shows any failure in plain English.
  async function step<T>(label: string, request: () => Promise<ApiResult<T>>): Promise<T | null> {
    setBusy(label);
    setNotice(null);
    const result = await request();
    setBusy(null);
    if (!result.ok) {
      showError(result.error);
      return null;
    }
    return result.data;
  }

  async function refreshLint(): Promise<Lint | null> {
    const data = await step("checking", () =>
      postJson<LintResponse>("/api/lint", { post_path: post.postPath }),
    );
    return data;
  }

  function openCompare(next: Compare) {
    setCompare(next);
    setShowCompare(true);
  }

  async function changeLength(length: LengthValue, target: number | null) {
    const data = await step("length", () =>
      postJson<LengthResponse>("/api/length", {
        post_path: post.postPath,
        length,
        ...(length === "custom" && target !== null ? { custom_target: target } : {}),
      }),
    );
    if (!data) return;
    setPendingCustom(false);
    setShowCompare(false);
    setCompare({ button: "Show previous version", heading: "Previous version", path: data.previous_path });
    const lint = await refreshLint();
    onPatch(channel, { length, lint: lint ?? post.lint });
  }

  function chooseLength(value: LengthValue) {
    if (value === "custom") {
      setPendingCustom(true);
      return;
    }
    setPendingCustom(false);
    void changeLength(value, null);
  }

  function applyCustom() {
    const target = Number.parseInt(customInput, 10);
    if (!Number.isInteger(target) || target <= 0) {
      setNotice({
        tone: "info",
        title: "Enter a whole number for the target size",
        detail: "For example, 800.",
      });
      return;
    }
    void changeLength("custom", target);
  }

  async function changeStyle(style: string) {
    setBusy("style");
    setNotice(null);
    const result = await onRedraft(channel, { style, length: post.length });
    setBusy(null);
    if (!result.ok) showError(result.error);
  }

  async function humanise() {
    const data = await step("humanise", () =>
      postJson<HumaniseResponse>("/api/humanise", { post_path: post.postPath }),
    );
    if (!data) return;
    openCompare({ button: "Show raw draft", heading: "Raw draft", path: data.raw_path });
    setShowCompare(false);
    const lint = await refreshLint();
    onPatch(channel, { humanised: true, lint: lint ?? post.lint });
  }

  async function enhance(aim: (typeof ENHANCE_AIMS)[number]["value"]) {
    const note = enhanceNote.trim();
    const data = await step("enhance", () =>
      postJson<EnhanceResponse>("/api/enhance", {
        post_path: post.postPath,
        aim,
        ...(note ? { note } : {}),
      }),
    );
    if (!data) return;
    setFactsKept(data.facts_preserved);
    setMenuOpen(false);
    openCompare({ button: "Show text before this change", heading: "Before this change", path: data.previous_path });
    setShowCompare(false);
    onPatch(channel, { lint: data.lint });
  }

  async function makeVariants() {
    const data = await step("variants", () =>
      postJson<VariantsResponse>("/api/variants", { post_path: post.postPath, count: variantCount }),
    );
    if (!data) return;
    setVariants(data.variants);
  }

  async function chooseVariant(variantIndex: number) {
    const chosen = variants?.find((variant) => variant.variant_index === variantIndex);
    const data = await step("select", () =>
      postJson<SelectVariantResponse>("/api/select-variant", {
        post_path: post.postPath,
        variant_index: variantIndex,
      }),
    );
    if (!data) return;
    setVariants(null);
    onPatch(channel, { lint: chosen?.lint ?? post.lint });
  }

  async function exportPost() {
    if (exportBlockedReason) return;
    setBusy("export");
    setNotice(null);
    const result = await downloadExport(`/api/export/post?post=${encodeURIComponent(post.postPath)}`);
    setBusy(null);
    if (!result.ok) {
      showError(result.error);
      return;
    }
    setNotice({ tone: "info", title: `Exported ${result.data.filename}` });
  }

  const comparedText = compare ? texts[compare.path] : undefined;

  return (
    <article className={cardSurface} aria-labelledby={headingId}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={headingId} className="text-lg font-semibold text-[#1B1F1D]">
          {CHANNEL_LABEL[channel]}
        </h2>
        <p className="text-sm text-[#5A605C]">
          {formatLabel(post.format)}, {statusLabel(post.lint.hard.length).toLowerCase()}
        </p>
      </header>

      {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label className={fieldLabel} htmlFor={`${headingId}-length`}>
            Length
          </label>
          <select
            id={`${headingId}-length`}
            className={fieldSelect}
            disabled={isBusy}
            value={pendingCustom ? "custom" : post.length}
            onChange={(event) => chooseLength(event.target.value as LengthValue)}
          >
            {LENGTH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {pendingCustom || post.length === "custom" ? (
            <div className="mt-1 flex flex-wrap items-end gap-2">
              <label htmlFor={customId} className="text-sm text-[#5A605C]">
                Target size
              </label>
              <input
                id={customId}
                type="number"
                inputMode="numeric"
                min={1}
                value={customInput}
                onChange={(event) => setCustomInput(event.target.value)}
                className={`h-10 w-28 rounded-md border border-[#CFD0C8] bg-[#FBFBF8] px-2.5 text-sm ${focusRing}`}
              />
              <button type="button" onClick={applyCustom} disabled={isBusy} className={buttonSecondary}>
                Apply
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <label className={fieldLabel} htmlFor={`${headingId}-style`}>
            Writing style
          </label>
          <select
            id={`${headingId}-style`}
            className={fieldSelect}
            disabled={isBusy}
            value={post.style}
            onChange={(event) => void changeStyle(event.target.value)}
          >
            {STYLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-[#E2E3DC] bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-[#1B1F1D]">Humanise</p>
          <p className="text-sm leading-5 text-[#5A605C]">Removes stock AI phrasing. Your raw draft is kept.</p>
        </div>
        <button type="button" onClick={() => void humanise()} disabled={isBusy} className={buttonSecondary}>
          {busy === "humanise" ? "Humanising..." : "Humanise"}
        </button>
      </div>

      <div className="rounded-md border border-[#D6D7D0] bg-white p-3.5">
        {body === undefined ? (
          <p className="text-sm text-[#5A605C]">Loading the post...</p>
        ) : body === null ? (
          <p className="text-sm text-[#7F1D1D]">The post text could not be loaded. Try again in a moment.</p>
        ) : (
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#1B1F1D] break-words">{body}</p>
        )}
      </div>

      {compare ? (
        <div className="flex flex-col gap-2">
          <div>
            <button
              type="button"
              className={buttonQuiet}
              aria-expanded={showCompare}
              onClick={() => setShowCompare((value) => !value)}
            >
              {showCompare ? "Hide " + compare.heading.toLowerCase() : compare.button}
            </button>
          </div>
          {showCompare ? (
            <div className="rounded-md border border-dashed border-[#B9BCB5] bg-[#F4F4F0] p-3.5">
              <p className="mb-2 text-sm font-medium text-[#5A605C]">{compare.heading}</p>
              {comparedText === undefined ? (
                <p className="text-sm text-[#5A605C]">Loading...</p>
              ) : comparedText === null ? (
                <p className="text-sm text-[#7F1D1D]">That version could not be loaded.</p>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-6 text-[#3A403C] break-words">{comparedText}</p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonSecondary}
          aria-expanded={menuOpen}
          disabled={isBusy}
          onClick={() => setMenuOpen((value) => !value)}
        >
          Make it better
        </button>
        <button type="button" className={buttonSecondary} disabled={isBusy} onClick={() => void makeVariants()}>
          {busy === "variants" ? "Writing openings..." : "Try other openings"}
        </button>
      </div>

      {menuOpen ? (
        <div className="flex flex-col gap-3 rounded-md border border-[#D6D7D0] bg-white p-3.5">
          <p className="text-sm font-medium text-[#1B1F1D]">What should change?</p>
          <div className="grid grid-cols-2 gap-2">
            {ENHANCE_AIMS.map((aim) => (
              <button
                key={aim.value}
                type="button"
                disabled={isBusy}
                onClick={() => void enhance(aim.value)}
                className={buttonSecondary}
              >
                {busy === "enhance" ? "Working..." : aim.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={enhanceNoteId} className="text-sm text-[#5A605C]">
              Optional note (one line)
            </label>
            <input
              id={enhanceNoteId}
              type="text"
              value={enhanceNote}
              onChange={(event) => setEnhanceNote(event.target.value)}
              placeholder="For example, lead with the cost saving"
              className={`h-10 w-full rounded-md border border-[#CFD0C8] bg-[#FBFBF8] px-2.5 text-sm ${focusRing}`}
            />
          </div>
          {factsKept !== null ? (
            <p className={`text-sm ${factsKept ? "text-[#1E5C3A]" : "text-[#6B4300]"}`}>
              {factsKept
                ? "Facts check: every fact from the previous text is kept."
                : "Facts check: some facts may have changed. Read the text before you export."}
            </p>
          ) : null}
        </div>
      ) : null}

      {variants ? (
        <VariantCompare variants={variants} busy={isBusy} onUse={(index) => void chooseVariant(index)} />
      ) : null}

      <LintBox lint={post.lint} />

      <div className="flex flex-col gap-3 border-t border-[#E2E3DC] pt-4">
        {post.reviewRequired ? (
          <label className="flex items-start gap-2.5 text-sm leading-6 text-[#1B1F1D]">
            <input
              type="checkbox"
              checked={reviewConfirmed}
              onChange={(event) => setReviewConfirmed(event.target.checked)}
              className="mt-1 size-4 accent-[#1F4E8C]"
            />
            <span>I have checked this post by hand, including any stats and claims.</span>
          </label>
        ) : null}
        <div className="flex flex-col gap-2">
          <div>
            <button
              type="button"
              onClick={() => void exportPost()}
              disabled={isBusy || exportBlockedReason !== null}
              className={buttonPrimary}
            >
              {busy === "export" ? "Exporting..." : "Export"}
            </button>
          </div>
          {exportBlockedReason ? (
            <p className="text-sm text-[#5A605C]">{sanitizeText(exportBlockedReason)}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
