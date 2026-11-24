"use client";

import { useEffect, useId, useState } from "react";
import { adaptWeek, buildPillar, downloadWeekZip, getPillar, getWeekView, type ApiResult } from "./api";
import { BriefForm } from "./BriefForm";
import {
  countCards,
  currentWeekId,
  exportDisabledReason,
  groupWeekDays,
  isoWeekIdFromDate,
  mondayOfWeek,
  plainWeekError,
  summariseAdapt,
  weekPathFor,
  type WeekColumn,
} from "./logic";
import { Notice, type NoticeState } from "./Notice";
import { PillarPanel } from "./PillarPanel";
import { WeekGrid } from "./WeekGrid";
import type { PillarBodyResponse, ViewDay, WeekViewResponse } from "./types";

type ViewState =
  | { status: "ready"; columns: WeekColumn[]; cardCount: number }
  | { status: "empty" }
  | { status: "error"; notice: NoticeState };

type PillarState =
  | { status: "none" }
  | { status: "ready"; body: string }
  | { status: "error"; notice: NoticeState };

type Loaded = {
  weekId: string;
  key: number;
  view: ViewState;
  pillar: PillarState;
};

// A missing pillar is normal. Any other failure must not offer to build a new one over it.
function toPillarState(result: ApiResult<PillarBodyResponse>): PillarState {
  if (result.ok) return { status: "ready", body: result.data.body };
  if (result.status === 404) return { status: "none" };
  return { status: "error", notice: { tone: "error", error: plainWeekError(result.error) } };
}

function toViewState(weekId: string, result: ApiResult<WeekViewResponse>): ViewState {
  if (!result.ok) {
    if (result.status === 404) return { status: "empty" };
    return { status: "error", notice: { tone: "error", error: plainWeekError(result.error) } };
  }
  const days: ViewDay[] = result.data.days;
  const columns = groupWeekDays(weekId, days);
  const cardCount = countCards(columns);
  if (cardCount === 0) return { status: "empty" };
  return { status: "ready", columns, cardCount };
}

export function WeekScreen() {
  const pickerId = useId();
  // Read the date once on mount. The server and the browser agree on the same machine.
  const [weekId, setWeekId] = useState<string>(() => currentWeekId(new Date()));
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [pillarBuilds, setPillarBuilds] = useState(0);
  const [busy, setBusy] = useState<"pillar" | "adapt" | "export" | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [adaptMessage, setAdaptMessage] = useState<string | null>(null);
  const pillarSectionId = useId();
  const viewSectionId = useId();

  // Loads the view and the pillar for the chosen week. Old results are ignored by the cancel flag.
  useEffect(() => {
    let cancelled = false;
    Promise.all([getWeekView(weekId), getPillar(weekId)]).then(([viewResult, pillarResult]) => {
      if (cancelled) return;
      setLoaded({
        weekId,
        key: reloadKey,
        view: toViewState(weekId, viewResult),
        pillar: toPillarState(pillarResult),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [weekId, reloadKey]);

  const current = loaded && loaded.weekId === weekId && loaded.key === reloadKey ? loaded : null;
  const view: ViewState | null = current ? current.view : null;
  const pillar: PillarState | null = current ? current.pillar : null;
  const weekPath = weekPathFor(weekId);
  const cardCount = view && view.status === "ready" ? view.cardCount : 0;
  const hasWeek = view !== null && view.status !== "empty";
  const exportReason = exportDisabledReason(cardCount);

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function onPickWeek(value: string) {
    const next = isoWeekIdFromDate(value);
    if (next) {
      setNotice(null);
      setAdaptMessage(null);
      setWeekId(next);
    }
  }

  async function onBuildPillar() {
    setBusy("pillar");
    setNotice(null);
    const result = await buildPillar(weekPath);
    setBusy(null);
    if (!result.ok) {
      setNotice({ tone: "error", error: plainWeekError(result.error) });
      return;
    }
    setPillarBuilds((count) => count + 1);
    reload();
  }

  async function onWriteWeek() {
    setBusy("adapt");
    setNotice(null);
    setAdaptMessage(null);
    const result = await adaptWeek(weekPath);
    setBusy(null);
    if (!result.ok) {
      setNotice({ tone: "error", error: plainWeekError(result.error) });
      return;
    }
    const summary = summariseAdapt(result.data.posts);
    setAdaptMessage(
      summary.skipped > 0
        ? `Wrote ${summary.written} posts. Skipped ${summary.skipped} you have edited.`
        : `Wrote ${summary.written} posts.`,
    );
    reload();
  }

  async function onExport() {
    setBusy("export");
    setNotice(null);
    const result = await downloadWeekZip(weekId);
    setBusy(null);
    if (!result.ok) setNotice({ tone: "error", error: plainWeekError(result.error) });
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Week</h1>
          <p className="muted">Write one campaign brief and get seven days of posts for three channels.</p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={pickerId} className="text-sm font-medium">
            Week starting (Monday)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id={pickerId}
              type="date"
              value={mondayOfWeek(weekId) ?? ""}
              onChange={(event) => onPickWeek(event.target.value)}
              className="h-10 rounded-md border border-[#b9c6c2] bg-[var(--surface)] px-2.5 text-[var(--ink)]"
            />
            <span className="text-sm tabular-nums text-[var(--muted)]">{weekId}</span>
          </div>
        </div>
      </header>

      {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}

      <details className="group rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-4 sm:p-5" open={!hasWeek}>
        <summary className="cursor-pointer text-lg font-semibold">Campaign brief</summary>
        <div className="mt-4">
          <BriefForm weekId={weekId} onCreated={reload} />
        </div>
      </details>

      <section aria-labelledby={pillarSectionId} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id={pillarSectionId} className="section-title">
            Long-form draft
          </h2>
          {pillar && pillar.status === "none" && hasWeek ? (
            <button
              type="button"
              onClick={onBuildPillar}
              disabled={busy !== null}
              className="h-10 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy === "pillar" ? "Building the long-form draft..." : "Build the long-form draft"}
            </button>
          ) : null}
        </div>

        {pillar && pillar.status === "ready" ? (
          <PillarPanel
            key={`${weekId}:${pillarBuilds}`}
            weekPath={weekPath}
            initialBody={pillar.body}
            onSaved={reload}
          />
        ) : pillar && pillar.status === "error" ? (
          <Notice notice={pillar.notice} onDismiss={reload} />
        ) : (
          <p className="muted">
            {hasWeek
              ? "No long-form draft yet. Build it from the campaign brief."
              : "No week yet. Enter a brief to start."}
          </p>
        )}

        {pillar && pillar.status === "ready" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <button
              type="button"
              onClick={onWriteWeek}
              disabled={busy !== null}
              className="h-10 self-start rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy === "adapt" ? "Writing the week..." : "Write the week"}
            </button>
            {adaptMessage ? (
              <p role="status" className="text-sm text-[var(--ok-ink)]">
                {adaptMessage}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section aria-labelledby={viewSectionId} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id={viewSectionId} className="section-title">
              Week view
            </h2>
            {view && view.status === "ready" ? (
              <p className="muted">
                {view.cardCount} {view.cardCount === 1 ? "post" : "posts"} across seven days.
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <button
              type="button"
              onClick={onExport}
              disabled={busy !== null || exportReason !== null}
              className="h-10 rounded-md border border-[var(--ink)] px-4 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] disabled:opacity-50"
            >
              {busy === "export" ? "Preparing the ZIP..." : "Export week (ZIP)"}
            </button>
            {exportReason ? <p className="text-xs text-[var(--muted)]">{exportReason}</p> : null}
          </div>
        </div>

        {!current || view === null ? (
          <p className="muted">Loading the week...</p>
        ) : view.status === "empty" ? (
          <p className="muted">No week yet. Enter a brief to start.</p>
        ) : view.status === "error" ? (
          <Notice notice={view.notice} onDismiss={reload} />
        ) : (
          <WeekGrid columns={view.columns} onChanged={reload} />
        )}
      </section>
    </div>
  );
}
