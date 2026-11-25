"use client";

import { useState } from "react";

type Angle = { title: string; hooks: string[]; format: string; why_it_could_travel: string };
type Issue = { id: string; message: string };
type Result = {
  platform: string;
  path: string;
  body: string;
  passed: boolean;
  hard: Issue[];
  soft: Issue[];
  variants: number;
  humanised: boolean;
  notes: string[];
};

const PLATFORM_NAMES: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
};

const NOTE_TEXT: Record<string, string> = {
  voice_missing: "No voice file found, so the draft uses a neutral voice.",
  humanise_failed: "The natural-sounding rewrite did not work, so the first draft is kept.",
  length_miss: "The draft is outside the target length.",
  variant_dropped: "One alternative version was dropped because it changed a number.",
  variants_failed: "Alternative versions could not be made.",
};

function noteText(n: string): string {
  if (n.startsWith("error:")) return "This platform failed. Nothing was saved for it.";
  return NOTE_TEXT[n] ?? n;
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "Could not reach the app. Is it still running?" } };
  }
}

export default function DailyFlow() {
  const [topic, setTopic] = useState("");
  const [date, setDate] = useState("");
  const [usedTopic, setUsedTopic] = useState("");
  const [angles, setAngles] = useState<Angle[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState<"" | "angles" | "draft">("");
  const [error, setError] = useState("");
  const [picked, setPicked] = useState("");

  async function getAngles(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setAngles([]);
    setResults([]);
    setPicked("");
    setBusy("angles");
    const { ok, data } = await postJson("/api/ideas", { topic });
    setBusy("");
    if (!ok) {
      setError(typeof data.error === "string" ? data.error : "Something went wrong.");
      return;
    }
    setAngles(data.angles as Angle[]);
    setDate(data.date as string);
    setUsedTopic(data.topic as string);
  }

  async function draft(angle: Angle) {
    if (busy) return;
    setError("");
    setResults([]);
    setPicked(angle.title);
    setBusy("draft");
    const { ok, data } = await postJson("/api/draft", { date, topic: usedTopic, angle: angle.title });
    setBusy("");
    if (!ok) {
      setError(typeof data.error === "string" ? data.error : "Something went wrong.");
      return;
    }
    setResults(data.results as Result[]);
  }

  return (
    <div className="mt-8 flex flex-col gap-10">
      <section aria-labelledby="step1">
        <h2 id="step1" className="text-lg font-semibold">
          Step 1. Your topic
        </h2>
        <form onSubmit={getAngles} className="mt-3 flex flex-col gap-3">
          <label htmlFor="topic" className="text-sm font-medium">
            What do you want to post about?
          </label>
          <textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={300}
            rows={3}
            className="w-full rounded-md border p-3 text-base"
          />
          <p className="text-xs text-neutral-500">{topic.length} of 300 characters</p>
          <div>
            <button
              type="submit"
              disabled={busy !== "" || topic.trim() === ""}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy === "angles" ? "Getting angles..." : "Get angles"}
            </button>
          </div>
        </form>
      </section>

      <div role="alert" aria-live="assertive">
        {error && <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      </div>

      {angles.length > 0 && (
        <section aria-labelledby="step2">
          <h2 id="step2" className="text-lg font-semibold">
            Step 2. Pick an angle
          </h2>
          <ul className="mt-3 flex flex-col gap-4">
            {angles.map((a) => (
              <li key={a.title} className="rounded-md border p-4">
                <h3 className="font-medium">{a.title}</h3>
                <p className="mt-2 text-sm font-medium text-neutral-700">Opening lines to try</p>
                <ol className="mt-1 list-decimal pl-5 text-sm text-neutral-700">
                  {a.hooks.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ol>
                <button
                  type="button"
                  onClick={() => draft(a)}
                  disabled={busy !== ""}
                  className="mt-3 rounded-md border px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
                >
                  {busy === "draft" && picked === a.title ? "Drafting..." : "Draft this angle"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.length > 0 && (
        <section aria-labelledby="step3">
          <h2 id="step3" className="text-lg font-semibold">
            Step 3. Your drafts
          </h2>
          <p className="mt-1 text-sm text-neutral-600">Saved on this computer. Nothing is posted anywhere.</p>
          <ul className="mt-3 flex flex-col gap-4">
            {results.map((r) => (
              <ResultCard key={r.platform} r={r} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ResultCard({ r }: { r: Result }) {
  return (
    <li className="rounded-md border p-4">
      <h3 className="font-medium">{PLATFORM_NAMES[r.platform] ?? r.platform}</h3>
      {r.path === "" ? (
        <p className="mt-2 text-sm text-red-800">This draft could not be made.</p>
      ) : (
        <>
          <p className="mt-2 text-sm">
            Check result:{" "}
            <strong className={r.passed ? "text-green-800" : "text-red-800"}>
              {r.passed ? "Passed" : "Needs a fix"}
            </strong>
          </p>
          {r.hard.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-sm text-red-800">
              {r.hard.map((i) => (
                <li key={i.id + i.message}>{i.message}</li>
              ))}
            </ul>
          )}
          {r.soft.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-sm text-neutral-700">
              {r.soft.map((i) => (
                <li key={i.id + i.message}>{i.message}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm text-neutral-600">Saved as content/{r.path}</p>
        </>
      )}
      {r.notes.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm text-neutral-600">
          {r.notes.map((n) => (
            <li key={n}>{noteText(n)}</li>
          ))}
        </ul>
      )}
      {r.body !== "" && (
        <pre className="mt-3 whitespace-pre-wrap break-words rounded-md bg-neutral-50 p-3 text-sm">{r.body}</pre>
      )}
    </li>
  );
}
