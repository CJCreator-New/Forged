"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FEATURE_DEFAULTS } from "../../lib/features/defaults";
import {
  CARD_OPTIONS,
  CORNER_OPTIONS,
  KEY_LABELS,
  LENGTH_OPTIONS,
  LOGO_CORNER_OPTIONS,
  LOGO_SIZE_OPTIONS,
  PADDING_OPTIONS,
  SWITCH_COPY,
  TASK_LABELS,
  THEME_OPTIONS,
  describeDefault,
  parseWholeNumber,
  type Option,
  type SwitchKey,
} from "./options";

type FeatureRow = { key: SwitchKey; default: unknown; current: unknown };
type KeyStatus = { name: string; set: boolean };
type ServiceUsage = { used: number; cap: number; remaining: number };
type SearchMonth = { month: string; tavily: ServiceUsage; firecrawl: ServiceUsage } | null;
type SettingsData = {
  keys: KeyStatus[];
  models: { tasks: Record<string, { primary: string; fallback: string[] }> };
  counters: { search_month: SearchMonth; model_calls_today: Record<string, number> };
};
type ModelRow = { id: string; name: string; free: boolean };
type ModelsData = { fetched_at: string; models: ModelRow[] };
type KeyCheck = { valid: boolean; is_free_tier: boolean; limit_remaining: number | null };
type Notice = { tone: "ok" | "error"; text: string };

async function errorText(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export default function SettingsScreen() {
  const [features, setFeatures] = useState<Record<SwitchKey, unknown> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [models, setModels] = useState<ModelsData | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [keyCheck, setKeyCheck] = useState<{ busy: boolean; result?: KeyCheck; error?: string }>({ busy: false });

  // Everything loads when the page opens. The model list is fetched each time (decision).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [fRes, sRes] = await Promise.all([fetch("/api/features"), fetch("/api/settings")]);
        if (!fRes.ok) throw new Error(await errorText(fRes, "Could not load the switches."));
        if (!sRes.ok) throw new Error(await errorText(sRes, "Could not load settings."));
        const fBody = (await fRes.json()) as { switches: FeatureRow[] };
        const sBody = (await sRes.json()) as SettingsData;
        if (!alive) return;
        setFeatures(Object.fromEntries(fBody.switches.map((s) => [s.key, s.current])) as Record<SwitchKey, unknown>);
        setSettings(sBody);
      } catch (err) {
        if (alive) setLoadError(err instanceof Error ? err.message : "Could not load settings.");
      }
    })();
    (async () => {
      try {
        const res = await fetch("/api/models");
        if (!res.ok) throw new Error(await errorText(res, "Could not load the model list."));
        const body = (await res.json()) as ModelsData;
        if (alive) setModels(body);
      } catch (err) {
        if (alive) setModelsError(err instanceof Error ? err.message : "Could not load the model list.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Optimistic save: the control moves at once, and goes back if the server refuses the change.
  async function save(key: SwitchKey, value: unknown) {
    const previous = features?.[key];
    setFeatures((f) => (f ? { ...f, [key]: value } : f));
    setNotice(null);
    try {
      const res = await fetch("/api/features", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        setFeatures((f) => (f ? { ...f, [key]: previous } : f));
        setNotice({ tone: "error", text: await errorText(res, "That change was not saved.") });
        return;
      }
      const body = (await res.json()) as { value: unknown };
      setFeatures((f) => (f ? { ...f, [key]: body.value } : f));
      setNotice({ tone: "ok", text: `Saved: ${SWITCH_COPY[key].label}.` });
    } catch {
      setFeatures((f) => (f ? { ...f, [key]: previous } : f));
      setNotice({ tone: "error", text: "Could not reach the app. Try again." });
    }
  }

  async function checkOpenRouter() {
    setKeyCheck({ busy: true });
    try {
      const res = await fetch("/api/keys/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "openrouter" }),
      });
      if (!res.ok) {
        setKeyCheck({ busy: false, error: await errorText(res, "The key could not be checked.") });
        return;
      }
      setKeyCheck({ busy: false, result: (await res.json()) as KeyCheck });
    } catch {
      setKeyCheck({ busy: false, error: "Could not reach the app. Try again." });
    }
  }

  if (loadError) {
    return (
      <div className="settings-stack">
        <h1 className="page-title">Settings</h1>
        <p className="notice notice-error" role="alert">{loadError}</p>
      </div>
    );
  }
  if (!features || !settings) {
    return (
      <div className="settings-stack">
        <h1 className="page-title">Settings</h1>
        <p className="muted">Loading settings.</p>
      </div>
    );
  }

  const v = <K extends SwitchKey>(key: K) => features[key] as (typeof FEATURE_DEFAULTS)[K];
  const styling = v("styling");
  const logo = v("logo");
  const perf = v("performance_loop");

  const row = (key: SwitchKey, control: ReactNode) => (
    <li className="feature-row" key={key}>
      <div className="feature-text">
        <h3 className="feature-title" id={`${key}-title`}>{SWITCH_COPY[key].label}</h3>
        <p className="feature-help">{SWITCH_COPY[key].help}</p>
        <p className="caption">Default: {describeDefault(key, FEATURE_DEFAULTS[key])}</p>
        <p className="caption caption-key">{key}</p>
      </div>
      <div className="feature-control" role="group" aria-labelledby={`${key}-title`}>
        {control}
      </div>
    </li>
  );

  const sortedModels = models
    ? [...models.models].sort((a, b) => Number(b.free) - Number(a.free) || a.name.localeCompare(b.name))
    : [];

  return (
    <div className="settings-stack">
      <header>
        <h1 className="page-title">Settings</h1>
        <p className="muted">Turn features on or off. Changes save straight away.</p>
      </header>

      {notice ? (
        <p className={notice.tone === "ok" ? "notice notice-ok" : "notice notice-error"} role="status">
          {notice.text}
        </p>
      ) : null}

      <section aria-labelledby="features-heading" className="section">
        <h2 id="features-heading" className="section-title">Features</h2>
        <ul className="feature-list">
          {row("trend_mode", <Toggle label={SWITCH_COPY.trend_mode.label} checked={v("trend_mode")} onChange={(x) => save("trend_mode", x)} />)}
          {row("humanise", <Toggle label={SWITCH_COPY.humanise.label} checked={v("humanise")} onChange={(x) => save("humanise", x)} />)}
          {row("carousel_render", <Toggle label={SWITCH_COPY.carousel_render.label} checked={v("carousel_render")} onChange={(x) => save("carousel_render", x)} />)}
          {row("icons", <Toggle label={SWITCH_COPY.icons.label} checked={v("icons")} onChange={(x) => save("icons", x)} />)}
          {row(
            "theme",
            <SelectField label={SWITCH_COPY.theme.label} value={v("theme")} options={THEME_OPTIONS} onChange={(x) => save("theme", x)} />,
          )}
          {row(
            "styling",
            <>
              <SelectField label="Corner shape" value={styling.corner} options={CORNER_OPTIONS} onChange={(x) => save("styling", { ...styling, corner: x })} />
              <SelectField label="Card style" value={styling.card} options={CARD_OPTIONS} onChange={(x) => save("styling", { ...styling, card: x })} />
              <SelectField label="Spacing" value={styling.padding} options={PADDING_OPTIONS} onChange={(x) => save("styling", { ...styling, padding: x })} />
            </>,
          )}
          {row(
            "logo",
            <>
              <Toggle label="Show logo" checked={logo.enabled} onChange={(x) => save("logo", { ...logo, enabled: x })} />
              <SelectField label="Logo corner" value={logo.corner} options={LOGO_CORNER_OPTIONS} onChange={(x) => save("logo", { ...logo, corner: x })} />
              <SelectField label="Logo size" value={logo.size} options={LOGO_SIZE_OPTIONS} onChange={(x) => save("logo", { ...logo, size: x })} />
              <NumberField
                label="Logo opacity (percent)"
                value={Math.round(logo.opacity * 100)}
                min={60}
                max={100}
                onCommit={(p) => save("logo", { ...logo, opacity: p / 100 })}
                hint="From 60 to 100."
              />
              <Toggle label="Show on every slide" checked={logo.all_slides} onChange={(x) => save("logo", { ...logo, all_slides: x })} />
            </>,
          )}
          {row(
            "variants",
            <NumberField label="Variants per post" value={v("variants")} min={2} max={3} onCommit={(n) => save("variants", n)} hint="2 or 3." />,
          )}
          {row(
            "length",
            <SelectField label={SWITCH_COPY.length.label} value={v("length")} options={LENGTH_OPTIONS} onChange={(x) => save("length", x)} />,
          )}
          {row(
            "performance_loop",
            <>
              <Toggle label="Learn from past posts" checked={perf.enabled} onChange={(x) => save("performance_loop", { ...perf, enabled: x })} />
              <NumberField
                label="Start after this many posts"
                value={perf.min_posts}
                min={0}
                max={10000}
                onCommit={(n) => save("performance_loop", { ...perf, min_posts: n })}
                hint="Whole number."
              />
              <NumberField
                label="Smallest group to compare"
                value={perf.min_group}
                min={0}
                max={10000}
                onCommit={(n) => save("performance_loop", { ...perf, min_group: n })}
                hint="Whole number."
              />
            </>,
          )}
          {row(
            "linter_soft_warnings",
            <Toggle label={SWITCH_COPY.linter_soft_warnings.label} checked={v("linter_soft_warnings")} onChange={(x) => save("linter_soft_warnings", x)} />,
          )}
        </ul>
      </section>

      <section aria-labelledby="keys-heading" className="section">
        <h2 id="keys-heading" className="section-title">Keys</h2>
        <p className="muted">A key is set or not set. Its value is never shown here. Keys live in your .env.local file.</p>
        <ul className="plain-list">
          {settings.keys.map((k) => (
            <li className="key-row" key={k.name}>
              <div>
                <p className="item-title">{KEY_LABELS[k.name] ?? k.name}</p>
                <p className="caption caption-key">{k.name}</p>
              </div>
              <p className={k.set ? "status status-ok" : "status status-warn"}>
                {k.set ? "Set" : "Not set. Add it to .env.local and restart the app."}
              </p>
            </li>
          ))}
        </ul>
        {settings.keys.find((k) => k.name === "OPENROUTER_API_KEY")?.set ? (
          <div className="key-check">
            <button type="button" className="button" onClick={checkOpenRouter} disabled={keyCheck.busy}>
              {keyCheck.busy ? "Checking" : "Check OpenRouter key"}
            </button>
            {keyCheck.error ? <p className="notice notice-error" role="alert">{keyCheck.error}</p> : null}
            {keyCheck.result ? (
              <p className="notice" role="status">
                {keyCheck.result.valid
                  ? `Key works. ${keyCheck.result.is_free_tier ? "Free tier." : "Paid account."} ${
                      keyCheck.result.limit_remaining === null
                        ? "No credit limit shown."
                        : `Credit left: $${keyCheck.result.limit_remaining.toFixed(2)}.`
                    }`
                  : "OpenRouter rejected this key. Check it in .env.local."}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="models-heading" className="section">
        <h2 id="models-heading" className="section-title">Models</h2>
        <p className="muted">The model list refreshes every time this page opens.</p>
        <h3 className="item-heading">Which model each task uses</h3>
        <ul className="plain-list">
          {Object.entries(settings.models.tasks).map(([task, t]) => (
            <li className="task-row" key={task}>
              <p className="item-title">{TASK_LABELS[task] ?? task}</p>
              <p className="caption caption-key">{t.primary}</p>
              <p className="caption">{t.fallback.length === 0 ? "No backup model." : `${t.fallback.length} backup ${t.fallback.length === 1 ? "model" : "models"}.`}</p>
            </li>
          ))}
        </ul>
        <h3 className="item-heading">Models on OpenRouter</h3>
        {modelsError ? <p className="notice notice-error" role="alert">{modelsError}</p> : null}
        {!models && !modelsError ? <p className="muted">Loading the model list.</p> : null}
        {models ? (
          <>
            <p className="caption">Free models are marked. {models.models.filter((m) => m.free).length} free out of {models.models.length}.</p>
            <ul className="model-list" aria-label="Models on OpenRouter">
              {sortedModels.map((m) => (
                <li className="model-row" key={m.id}>
                  <span className="model-name">{m.name}</span>
                  <span className="caption caption-key">{m.id}</span>
                  <span className={m.free ? "tag tag-free" : "tag"}>{m.free ? "Free" : "Paid"}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section aria-labelledby="usage-heading" className="section">
        <h2 id="usage-heading" className="section-title">Usage</h2>
        <dl className="usage-list">
          <div>
            <dt className="item-title">Model calls today</dt>
            <dd>
              {Object.entries(settings.counters.model_calls_today).map(([provider, n]) => (
                <p key={provider}>{provider === "openrouter" ? "OpenRouter" : provider}: {n}</p>
              ))}
              <p className="caption">Counted per provider. Resets at midnight your time.</p>
            </dd>
          </div>
          <div>
            <dt className="item-title">Search credits this month</dt>
            <dd>
              {settings.counters.search_month ? (
                <>
                  <p>
                    Tavily: {settings.counters.search_month.tavily.used} used, {settings.counters.search_month.tavily.remaining} left of {settings.counters.search_month.tavily.cap}.
                  </p>
                  <p>
                    Firecrawl: {settings.counters.search_month.firecrawl.used} used, {settings.counters.search_month.firecrawl.remaining} left of {settings.counters.search_month.firecrawl.cap}.
                  </p>
                  <p className="caption">Caps are fixed for now. Tavily is used first.</p>
                </>
              ) : (
                <p className="muted">Not available yet.</p>
              )}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle"
      data-on={checked ? "true" : "false"}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-track" aria-hidden="true"><span className="toggle-knob" /></span>
      <span className="toggle-text">{checked ? "On" : "Off"}</span>
    </button>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (next: string) => void }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

// Whole-number field. Commits on blur or Enter, and only when the value is in range.
function NumberField({
  label,
  value,
  min,
  max,
  onCommit,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (n: number) => void;
  hint: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(value);

  // When the saved value changes from outside this field, follow it.
  if (synced !== value) {
    setSynced(value);
    setDraft(String(value));
    setError(null);
  }

  function commit() {
    const n = parseWholeNumber(draft, min, max);
    if (n === null) {
      setError(`Enter a whole number from ${min} to ${max}.`);
      setDraft(String(value));
      return;
    }
    setError(null);
    if (n !== value) onCommit(n);
  }

  return (
    <div className="field">
      <label className="field-label">
        {label}
        <input
          className="number"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
        />
      </label>
      <span className="caption">{hint}</span>
      {error ? <span className="field-error" role="alert">{error}</span> : null}
    </div>
  );
}
