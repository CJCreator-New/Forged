"use client";

import { useId, useState } from "react";
import {
  CARD_OPTIONS,
  COLOUR_KEYS,
  COLOUR_LABELS,
  CORNER_OPTIONS,
  PADDING_OPTIONS,
  THEME_OPTIONS,
  isHexColour,
  type Card,
  type ColourKey,
  type Colours,
  type Corner,
  type DeckTheme,
  type Padding,
} from "./deckHelpers";
import { THEME_COLORS } from "../../lib/pipeline/deck/themes";
import styles from "./DeckEditor.module.css";

type Props = {
  theme: DeckTheme;
  colours: Colours;
  corner: Corner;
  card: Card;
  padding: Padding;
  icons: boolean;
  iconColour: string | null;
  keepChanged: boolean;
  onTheme: (theme: DeckTheme) => void;
  onKeepChanged: (keep: boolean) => void;
  onColour: (key: ColourKey, value: string) => void;
  onCorner: (value: Corner) => void;
  onCard: (value: Card) => void;
  onPadding: (value: Padding) => void;
  onIcons: (on: boolean) => void;
  onIconColour: (value: string | null) => void;
};

export default function LookControls(props: Props) {
  return (
    <>
      <section className={styles.section} aria-labelledby="look-heading">
        <div className={styles.sectionHead}>
          <h2 id="look-heading" className="section-title">Look</h2>
          <p className={styles.sectionIntro}>Pick a starting look. It sets the colours below.</p>
        </div>
        <div className={styles.themeGrid} role="group" aria-label="Look">
          {THEME_OPTIONS.map((option) => {
            const preset = THEME_COLORS[option.value];
            const pressed = props.theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={styles.themeButton}
                aria-pressed={pressed}
                onClick={() => props.onTheme(option.value)}
              >
                <span className={styles.swatches} aria-hidden="true">
                  {COLOUR_KEYS.map((key) => (
                    <span key={key} className={styles.swatch} style={{ background: preset[key] }} />
                  ))}
                </span>
                <span className="item-title">{option.label}</span>
              </button>
            );
          })}
        </div>
        <label className={styles.fieldRow}>
          <input
            type="checkbox"
            checked={props.keepChanged}
            onChange={(e) => props.onKeepChanged(e.target.checked)}
          />
          <span>Keep the colours I changed when I pick a look</span>
        </label>
        <p className="caption caption-key">theme</p>
      </section>

      <section className={styles.section} aria-labelledby="colours-heading">
        <div className={styles.sectionHead}>
          <h2 id="colours-heading" className="section-title">Colours</h2>
          <p className={styles.sectionIntro}>Changes show in the preview straight away. Slide text is not changed.</p>
        </div>
        {COLOUR_KEYS.map((key) => (
          <ColourField
            key={key}
            name={COLOUR_LABELS[key]}
            technical={key}
            value={props.colours[key]}
            onChange={(value) => props.onColour(key, value)}
          />
        ))}
      </section>

      <section className={styles.section} aria-labelledby="shape-heading">
        <div className={styles.sectionHead}>
          <h2 id="shape-heading" className="section-title">Shape</h2>
        </div>
        <Segmented
          legend="Corners"
          technical="corner"
          options={CORNER_OPTIONS}
          value={props.corner}
          onChange={(value) => props.onCorner(value as Corner)}
        />
        <Segmented
          legend="Card style"
          technical="card"
          options={CARD_OPTIONS}
          value={props.card}
          onChange={(value) => props.onCard(value as Card)}
        />
        <Segmented
          legend="Padding"
          technical="padding"
          options={PADDING_OPTIONS}
          value={props.padding}
          onChange={(value) => props.onPadding(value as Padding)}
        />
      </section>

      <section className={styles.section} aria-labelledby="icons-heading">
        <div className={styles.sectionHead}>
          <h2 id="icons-heading" className="section-title">Icons</h2>
          <p className={styles.sectionIntro}>When on, each slide can show one icon. Off by default.</p>
        </div>
        <ToggleRow label="Show icons" technical="icons" checked={props.icons} onChange={props.onIcons} />
        {props.icons ? (
          <IconColour value={props.iconColour} accent={props.colours.accent} onChange={props.onIconColour} />
        ) : null}
      </section>
    </>
  );
}

function ColourField({
  name,
  technical,
  value,
  onChange,
}: {
  name: string;
  technical: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const [invalid, setInvalid] = useState(false);

  // When the colour changes from outside (a theme pick or the colour picker), follow it.
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
    setInvalid(false);
  }

  function commit() {
    if (isHexColour(draft)) {
      setInvalid(false);
      if (draft.toLowerCase() !== value.toLowerCase()) onChange(draft.toLowerCase());
    } else {
      setInvalid(true);
    }
  }

  return (
    <div className={styles.colourRow}>
      <input
        type="color"
        className={styles.colourInput}
        value={isHexColour(value) ? value : "#000000"}
        aria-label={`${name} colour picker`}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
      />
      <label className={styles.colourName} htmlFor={id}>
        <span className="item-title">{name}</span>
        <span className="caption caption-key">{technical}</span>
      </label>
      <input
        id={id}
        type="text"
        className={styles.hexInput}
        value={draft}
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-hint` : undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
      {invalid ? (
        <p id={`${id}-hint`} className="caption" style={{ gridColumn: "2 / -1", color: "var(--error-ink)" }}>
          Use six digits, like #1d5c58.
        </p>
      ) : null}
    </div>
  );
}

function IconColour({
  value,
  accent,
  onChange,
}: {
  value: string | null;
  accent: string;
  onChange: (value: string | null) => void;
}) {
  const shown = value ?? accent;
  return (
    <div className={styles.group}>
      <div className={styles.iconColourRow}>
        <input
          type="color"
          className={styles.colourInput}
          value={isHexColour(shown) ? shown : "#000000"}
          aria-label="Icon colour"
          onChange={(e) => onChange(e.target.value.toLowerCase())}
        />
        <span className="item-title">Icon colour</span>
        <button type="button" className="toggle" onClick={() => onChange(null)} disabled={value === null}>
          <span className="toggle-text">Use the accent colour</span>
        </button>
      </div>
      <p className="caption">Follows the accent colour unless you pick one here. Shown in the preview for now.</p>
    </div>
  );
}

export function Segmented({
  legend,
  technical,
  options,
  value,
  onChange,
}: {
  legend: string;
  technical: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className={styles.segmented}>
      <legend className="item-title">
        {legend} <span className="caption caption-key">{technical}</span>
      </legend>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.segment}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

export function ToggleRow({
  label,
  technical,
  checked,
  onChange,
}: {
  label: string;
  technical: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className={styles.group}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="toggle"
        data-on={checked ? "true" : "false"}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-track" aria-hidden="true">
          <span className="toggle-knob" />
        </span>
        <span className="toggle-text">
          {label} <span className="caption caption-key">{technical}</span>
        </span>
      </button>
    </div>
  );
}
