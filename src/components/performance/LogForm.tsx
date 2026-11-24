"use client";

import { useState, type FormEvent } from "react";
import { errorMessage, INPUT_CLASS } from "./api";
import {
  buildLogRow,
  CHANNEL_OPTIONS,
  EDIT_RATING_OPTIONS,
  emptyLogForm,
  FORMAT_OPTIONS,
  LENGTH_OPTIONS,
  type LogFormState,
} from "./view";

// Logs one post. Channel, format and length stay filled in for the next post.
export default function LogForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState<LogFormState>(() => emptyLogForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  function update<K extends keyof LogFormState>(key: K, value: LogFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);

    const built = buildLogRow(form);
    if ("error" in built) {
      setError(built.error);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/perf/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ row: built.row }),
      });
      if (!res.ok) {
        setError(await errorMessage(res, "The post was not logged."));
        return;
      }
      setStatus(`Logged post ${built.row.post_id}.`);
      setForm((current) => ({
        ...emptyLogForm(),
        date: current.date,
        channel: current.channel,
        format: current.format,
        length: current.length,
      }));
      onSaved();
    } catch {
      setError("Could not reach the app. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="field">
        <label className="field-label" htmlFor="perf-post-id">Post ID</label>
        <input
          id="perf-post-id"
          className={INPUT_CLASS}
          value={form.postId}
          onChange={(e) => update("postId", e.target.value)}
          autoComplete="off"
        />
        <p className="caption">Any ID you will recognise, such as the post’s name.</p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="perf-date">Date</label>
        <input
          id="perf-date"
          type="date"
          className={INPUT_CLASS}
          value={form.date}
          onChange={(e) => update("date", e.target.value)}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="perf-channel">Channel</label>
        <select
          id="perf-channel"
          className={INPUT_CLASS}
          value={form.channel}
          onChange={(e) => update("channel", e.target.value as LogFormState["channel"])}
        >
          {CHANNEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="field sm:col-span-2 lg:col-span-3">
        <label className="field-label" htmlFor="perf-topic">Topic</label>
        <input
          id="perf-topic"
          className={INPUT_CLASS}
          value={form.topic}
          onChange={(e) => update("topic", e.target.value)}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="perf-format">Format</label>
        <select
          id="perf-format"
          className={INPUT_CLASS}
          value={form.format}
          onChange={(e) => update("format", e.target.value as LogFormState["format"])}
        >
          {FORMAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="perf-length">Length</label>
        <select
          id="perf-length"
          className={INPUT_CLASS}
          value={form.length}
          onChange={(e) => update("length", e.target.value as LogFormState["length"])}
        >
          {LENGTH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="perf-variant">Variant</label>
        <input
          id="perf-variant"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          className={INPUT_CLASS}
          value={form.variant}
          onChange={(e) => update("variant", e.target.value)}
        />
        <p className="caption">Which draft you published, counting from 1.</p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="perf-minutes">Minutes</label>
        <input
          id="perf-minutes"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          className={INPUT_CLASS}
          value={form.minutes}
          onChange={(e) => update("minutes", e.target.value)}
        />
        <p className="caption">Time spent on the draft. Leave blank if you do not know.</p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="perf-edit-rating">Edit rating</label>
        <select
          id="perf-edit-rating"
          className={INPUT_CLASS}
          value={form.editRating}
          onChange={(e) => update("editRating", e.target.value as LogFormState["editRating"])}
        >
          <option value="">Leave blank</option>
          {EDIT_RATING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <p className="caption">
          How much you changed the draft. Saved as <span className="caption-key">as-is</span>,{" "}
          <span className="caption-key">light</span> or <span className="caption-key">rewrite</span>.
        </p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="perf-reach">Reach</label>
        <input
          id="perf-reach"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          className={INPUT_CLASS}
          value={form.reach}
          onChange={(e) => update("reach", e.target.value)}
        />
        <p className="caption">Add it once the platform shows it. Posts without reach are not counted.</p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="perf-followers">Followers</label>
        <input
          id="perf-followers"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          className={INPUT_CLASS}
          value={form.followers}
          onChange={(e) => update("followers", e.target.value)}
        />
      </div>

      <div className="sm:col-span-2 lg:col-span-3 flex flex-col gap-3">
        {error ? (
          <p className="notice notice-error m-0" role="alert">{error}</p>
        ) : null}
        {status ? (
          <p className="notice notice-ok m-0" role="status">{status}</p>
        ) : null}
        <div>
          <button type="submit" className="button" disabled={busy}>
            {busy ? "Saving the post" : "Log post"}
          </button>
        </div>
      </div>
    </form>
  );
}
