"use client";

import { useId, useState, type ChangeEvent } from "react";
import type { LogoCorner, LogoSize } from "../../lib/assets/logo";
import type { LogoSettings } from "../../lib/pipeline/deck/extras";
import {
  LOGO_CORNER_OPTIONS,
  LOGO_OPACITY_MAX,
  LOGO_OPACITY_MIN,
  LOGO_SIZE_OPTIONS,
  errorMessage,
  opacityFromPercent,
  percentFromOpacity,
} from "./deckHelpers";
import { Segmented, ToggleRow } from "./LookControls";
import styles from "./DeckEditor.module.css";

export type LogoStatus = { present: true; format: "png" | "svg"; width?: number } | { present: false; reason?: string } | null;

type Props = {
  status: LogoStatus;
  logo: LogoSettings;
  onChange: (patch: Partial<LogoSettings>) => void;
  onLogoUploaded: () => void;
};

// The logo block. With no logo file the slot is hidden and a plain line says where to put one.
export default function LogoControls({ status, logo, onChange, onLogoUploaded }: Props) {
  return (
    <section className={styles.section} aria-labelledby="logo-heading">
      <div className={styles.sectionHead}>
        <h2 id="logo-heading" className="section-title">Logo</h2>
      </div>
      {status === null ? <p className={styles.sectionIntro}>Checking for a logo.</p> : null}
      {status !== null && !status.present ? (
        <p className={styles.sectionIntro}>
          No logo added. Add a PNG or SVG file at content/assets/logo.png or logo.svg.
        </p>
      ) : null}
      {status !== null && status.present ? (
        <>
          <ToggleRow
            label="Show logo"
            technical="logo.enabled"
            checked={logo.enabled}
            onChange={(on) => onChange({ enabled: on })}
          />
          <Segmented
            legend="Logo corner"
            technical="logo.corner"
            options={LOGO_CORNER_OPTIONS}
            value={logo.corner}
            onChange={(value) => onChange({ corner: value as LogoCorner })}
          />
          <Segmented
            legend="Logo size"
            technical="logo.size"
            options={LOGO_SIZE_OPTIONS}
            value={logo.size}
            onChange={(value) => onChange({ size: value as LogoSize })}
          />
          <OpacitySlider
            value={logo.opacity}
            onChange={(opacity) => onChange({ opacity })}
          />
          <ToggleRow
            label="Show on every slide"
            technical="logo.all_slides"
            checked={logo.all_slides}
            onChange={(on) => onChange({ all_slides: on })}
          />
          <p className="caption">Off means the logo shows on the cover and call-to-action slides only.</p>
          <LogoReplace onUploaded={onLogoUploaded} />
        </>
      ) : null}
    </section>
  );
}

function OpacitySlider({ value, onChange }: { value: number; onChange: (opacity: number) => void }) {
  const id = useId();
  const percent = percentFromOpacity(value);
  return (
    <div className={styles.group}>
      <label htmlFor={id} className="item-title">
        Opacity <span className="caption caption-key">logo.opacity</span>
      </label>
      <div className={styles.fieldRow}>
        <input
          id={id}
          type="range"
          className={styles.slider}
          min={LOGO_OPACITY_MIN}
          max={LOGO_OPACITY_MAX}
          step={1}
          value={percent}
          aria-valuetext={`${percent} percent`}
          onChange={(e) => onChange(opacityFromPercent(Number(e.target.value)))}
        />
        <span className="caption-key">{percent}%</span>
      </div>
    </div>
  );
}

// Uploads a replacement logo. A file already saved gives logo_exists, and the user is offered a replace.
function LogoReplace({ onUploaded }: { onUploaded: () => void }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [offerReplace, setOfferReplace] = useState(false);

  async function send(file: File, replace: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("replace", replace ? "true" : "false");
      const res = await fetch("/api/logo", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as {
        accepted?: boolean;
        reason?: string;
        error?: { code?: string; message?: string };
      };
      if (res.ok && body.accepted) {
        setOfferReplace(false);
        setPending(null);
        setMessage("Logo saved.");
        onUploaded();
        return;
      }
      if (body.error?.code === "logo_exists") {
        setPending(file);
        setOfferReplace(true);
        setMessage(errorMessage("logo_exists"));
        return;
      }
      setMessage(body.reason ?? "The logo could not be saved. Use a PNG or SVG file.");
    } catch {
      setMessage("The logo could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void send(file, false);
  }

  return (
    <div className={styles.group}>
      <label htmlFor={id} className="item-title">
        Change logo file
      </label>
      <input
        id={id}
        type="file"
        accept=".png,.svg,image/png,image/svg+xml"
        className={styles.logoFile}
        disabled={busy}
        onChange={onPick}
      />
      {offerReplace && pending ? (
        <div className={styles.fieldRow}>
          <button type="button" className="toggle" onClick={() => void send(pending, true)} disabled={busy}>
            <span className="toggle-text">Replace the saved logo</span>
          </button>
        </div>
      ) : null}
      {message ? (
        <p className="caption" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
