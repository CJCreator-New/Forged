"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { LogRow } from "../../lib/schemas/log";
import type { Group } from "../../lib/perf/perf";
import { errorMessage } from "./api";
import LogForm from "./LogForm";
import LogRows from "./LogRows";
import ResetNumbers from "./ResetNumbers";
import { progressPercent, sentenceCase, thresholdLine, typicalEditLevel } from "./view";

type LoopOff = { enabled: false };
type LoopOn = {
  enabled: true;
  logged: number;
  needed: number;
  ranked: false | Group[];
  threshold: number;
  min_group: number;
  rows: LogRow[];
};
type PerfData = LoopOff | LoopOn;

export default function PerformanceScreen() {
  const [data, setData] = useState<PerfData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/perf");
      if (!res.ok) throw new Error(await errorMessage(res, "The performance numbers could not be loaded."));
      setData((await res.json()) as PerfData);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "The performance numbers could not be loaded.");
    }
  }, []);

  // First load. State is set only after the response arrives, and a late response is ignored after unmount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/perf");
        if (!res.ok) throw new Error(await errorMessage(res, "The performance numbers could not be loaded."));
        const json = (await res.json()) as PerfData;
        if (active) {
          setData(json);
          setLoadError(null);
        }
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : "The performance numbers could not be loaded.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="page-title">Performance</h1>
        <p className="muted">Record how each post did, then see which angles did best.</p>
      </header>

      {loadError ? (
        <p className="notice notice-error" role="alert">{loadError}</p>
      ) : null}

      {data === null && !loadError ? <p className="muted">Loading the numbers.</p> : null}

      {data && !data.enabled ? (
        <section aria-labelledby="ranking-off-heading" className="section">
          <h2 id="ranking-off-heading" className="section-title">Ranking is off</h2>
          <p className="muted">
            The performance loop is switched off, so no ranking runs and no numbers are worked out.
            Your log is kept. Turn the loop back on in Settings.
          </p>
          <Link href="/settings">Open Settings</Link>
        </section>
      ) : null}

      {data && data.enabled ? (
        <section aria-labelledby="ranking-heading" className="section">
          <h2 id="ranking-heading" className="section-title">Ranking</h2>
          <p className="m-0">{thresholdLine(data.logged, data.threshold, data.needed)}</p>
          {data.ranked === false ? (
            <>
              <div
                role="progressbar"
                aria-label="Posts logged toward the ranking"
                aria-valuemin={0}
                aria-valuemax={data.threshold}
                aria-valuenow={data.logged}
                className="mt-3 h-2 w-full max-w-[32rem] overflow-hidden rounded-full bg-[var(--accent-soft)]"
              >
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${progressPercent(data.logged, data.threshold)}%` }}
                />
              </div>
              <p className="muted mt-3">Until then, the angle list stays unranked.</p>
            </>
          ) : data.ranked.length === 0 ? (
            <p className="muted mt-3">
              No angle has {data.min_group} posts with reach yet. Keep logging and it will show here.
            </p>
          ) : (
            <ul className="mt-3 list-none p-0">
              {data.ranked.map((group) => (
                <li
                  key={`${group.topic}|${group.format}`}
                  className="border-b border-[var(--rule)] py-3 last:border-b-0"
                >
                  <p className="item-title">{sentenceCase(group.reason)}</p>
                  <p className="caption">Typical edit level: {typicalEditLevel(group.averageRating)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section aria-labelledby="log-heading" className="section">
        <h2 id="log-heading" className="section-title">Log a post</h2>
        <p className="muted">Enter what you know now. Reach and followers can be added later.</p>
        <LogForm onSaved={load} />
      </section>

      {data && data.enabled ? (
        <section aria-labelledby="rows-heading" className="section">
          <h2 id="rows-heading" className="section-title">Logged posts</h2>
          <p className="muted">
            {data.rows.length === 0
              ? "Nothing logged yet. Add your first post above."
              : `${data.rows.length} ${data.rows.length === 1 ? "post" : "posts"} logged.`}
          </p>
          {data.rows.length > 0 ? <LogRows rows={data.rows} onChanged={load} /> : null}
        </section>
      ) : null}

      {data && data.enabled ? (
        <section aria-labelledby="reset-heading" className="section">
          <h2 id="reset-heading" className="section-title">Start the numbers again</h2>
          <p className="muted">Your posts stay in the log. Only their reach and follower numbers are removed.</p>
          <ResetNumbers disabled={data.rows.length === 0} onCleared={load} />
        </section>
      ) : null}
    </div>
  );
}
