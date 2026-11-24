"use client";

import { useState } from "react";
import type { LogRow } from "../../lib/schemas/log";
import { errorMessage, SECONDARY_BUTTON_CLASS, SMALL_INPUT_CLASS } from "./api";
import {
  buildNumbers,
  CHANNEL_OPTIONS,
  displayNumber,
  EDIT_RATING_OPTIONS,
  FORMAT_OPTIONS,
  LENGTH_OPTIONS,
  optionLabel,
} from "./view";

const HEADERS = [
  "Date",
  "Post",
  "Channel",
  "Topic",
  "Format",
  "Length",
  "Variant",
  "Minutes",
  "Edit rating",
  "Reach",
  "Followers",
  "",
];

// Every logged post. Only reach and followers can be edited here.
export default function LogRows({ rows, onChanged }: { rows: LogRow[]; onChanged: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reachText, setReachText] = useState("");
  const [followersText, setFollowersText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(row: LogRow) {
    setError(null);
    setEditingId(row.post_id);
    setReachText(row.reach === null ? "" : String(row.reach));
    setFollowersText(row.followers === null ? "" : String(row.followers));
  }

  async function save(row: LogRow) {
    setError(null);
    const numbers = buildNumbers(reachText, followersText);
    if ("error" in numbers) {
      setError(numbers.error);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/perf/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ row: { ...row, reach: numbers.reach, followers: numbers.followers }, replace: true }),
      });
      if (!res.ok) {
        setError(await errorMessage(res, "The numbers were not saved."));
        return;
      }
      setEditingId(null);
      onChanged();
    } catch {
      setError("Could not reach the app. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error ? (
        <p className="notice notice-error" role="alert">{error}</p>
      ) : null}
      <div className="overflow-x-auto rounded-md border border-[var(--rule)] bg-[var(--surface)]">
        <table className="w-full min-w-[60rem] border-collapse text-[0.9375rem]">
          <thead>
            <tr>
              {HEADERS.map((header, i) => (
                <th
                  key={i}
                  scope="col"
                  className="whitespace-nowrap border-b border-[var(--rule)] px-3 py-2.5 text-left text-[0.8125rem] font-medium text-[var(--muted)]"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const editing = editingId === row.post_id;
              return (
                <tr key={row.post_id} className="align-top">
                  <td className="whitespace-nowrap border-b border-[var(--rule)] px-3 py-2.5">{row.date}</td>
                  <td className="border-b border-[var(--rule)] px-3 py-2.5 font-medium">{row.post_id}</td>
                  <td className="whitespace-nowrap border-b border-[var(--rule)] px-3 py-2.5">
                    {optionLabel(CHANNEL_OPTIONS, row.channel)}
                  </td>
                  <td className="border-b border-[var(--rule)] px-3 py-2.5">{row.topic}</td>
                  <td className="whitespace-nowrap border-b border-[var(--rule)] px-3 py-2.5">
                    {optionLabel(FORMAT_OPTIONS, row.format)}
                  </td>
                  <td className="whitespace-nowrap border-b border-[var(--rule)] px-3 py-2.5">
                    {optionLabel(LENGTH_OPTIONS, row.length)}
                  </td>
                  <td className="border-b border-[var(--rule)] px-3 py-2.5 text-right tabular-nums">{row.variant}</td>
                  <td className="border-b border-[var(--rule)] px-3 py-2.5 text-right tabular-nums">
                    {row.minutes === null ? "Not entered" : row.minutes}
                  </td>
                  <td className="whitespace-nowrap border-b border-[var(--rule)] px-3 py-2.5">
                    {optionLabel(EDIT_RATING_OPTIONS, row.edit_rating)}
                  </td>
                  <td className="border-b border-[var(--rule)] px-3 py-2.5 text-right tabular-nums">
                    {editing ? (
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        aria-label={`Reach for post ${row.post_id}`}
                        className={SMALL_INPUT_CLASS}
                        value={reachText}
                        onChange={(e) => setReachText(e.target.value)}
                      />
                    ) : (
                      displayNumber(row.reach)
                    )}
                  </td>
                  <td className="border-b border-[var(--rule)] px-3 py-2.5 text-right tabular-nums">
                    {editing ? (
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        aria-label={`Followers for post ${row.post_id}`}
                        className={SMALL_INPUT_CLASS}
                        value={followersText}
                        onChange={(e) => setFollowersText(e.target.value)}
                      />
                    ) : (
                      displayNumber(row.followers)
                    )}
                  </td>
                  <td className="whitespace-nowrap border-b border-[var(--rule)] px-3 py-2.5">
                    {editing ? (
                      <div className="flex gap-2">
                        <button type="button" className="button" disabled={busy} onClick={() => save(row)}>
                          {busy ? "Saving" : "Save numbers"}
                        </button>
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          disabled={busy}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => startEdit(row)}
                        aria-label={`Edit reach and followers for post ${row.post_id}`}
                      >
                        Edit numbers
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
