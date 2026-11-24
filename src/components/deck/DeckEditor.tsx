"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LogoSettings } from "../../lib/pipeline/deck/extras";
import type { Deck } from "../../lib/schemas/deck";
import {
  applyThemePreset,
  errorMessage,
  fileNameOf,
  hasDeckPatch,
  mergeDeckPatch,
  parseDeckResponse,
  type Card,
  type ColourKey,
  type Corner,
  type DeckPatch,
  type DeckTheme,
  type Padding,
} from "./deckHelpers";
import DeckPreview from "./DeckPreview";
import LogoControls, { type LogoStatus } from "./LogoControls";
import LookControls from "./LookControls";
import styles from "./DeckEditor.module.css";

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };
type RenderState = { busy: boolean; files: string[] | null; error: string | null };

const SAVE_DELAY_MS = 400;

// Editor for one deck's look. Slide text is never changed here.
export default function DeckEditor({ deckPath }: { deckPath: string }) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [icons, setIcons] = useState(false);
  const [logo, setLogo] = useState<LogoSettings | null>(null);
  const [iconColour, setIconColour] = useState<string | null>(null);
  const [keepChanged, setKeepChanged] = useState(true);
  const [logoStatus, setLogoStatus] = useState<LogoStatus>(null);
  const [featureOn, setFeatureOn] = useState<boolean | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [render, setRender] = useState<RenderState>({ busy: false, files: null, error: null });

  const pendingRef = useRef<DeckPatch>({});
  const timerRef = useRef<number | null>(null);
  const chainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const lastOkRef = useRef(true);

  const sendPatch = useCallback(
    async (body: DeckPatch): Promise<boolean> => {
      try {
        const res = await fetch("/api/deck", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deck_path: deckPath, ...body }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
          setSave({ kind: "error", message: errorMessage(json.error?.code) });
          lastOkRef.current = false;
          return false;
        }
        setSave({ kind: "saved" });
        lastOkRef.current = true;
        return true;
      } catch {
        setSave({ kind: "error", message: errorMessage(undefined) });
        lastOkRef.current = false;
        return false;
      }
    },
    [deckPath],
  );

  // Sends everything waiting in one PATCH. PATCHes run one after another so the server never races itself.
  // Resolves true when the latest save worked (or nothing was waiting).
  const flush = useCallback((): Promise<boolean> => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const body = pendingRef.current;
    if (hasDeckPatch(body)) {
      pendingRef.current = {};
      chainRef.current = chainRef.current.then(() => sendPatch(body));
    }
    return chainRef.current.then(() => lastOkRef.current);
  }, [sendPatch]);

  const queue = useCallback(
    (patch: DeckPatch) => {
      pendingRef.current = mergeDeckPatch(pendingRef.current, patch);
      setSave({ kind: "saving" });
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        void flush();
      }, SAVE_DELAY_MS);
    },
    [flush],
  );

  // Load the deck, the logo status and the carousel switch.
  useEffect(() => {
    let alive = true;
    if (!deckPath) return;
    (async () => {
      try {
        const res = await fetch(`/api/deck?path=${encodeURIComponent(deckPath)}`);
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
          if (alive) setLoadError(errorMessage(json.error?.code ?? "deck_invalid"));
          return;
        }
        const parsed = parseDeckResponse(await res.json());
        if (!parsed) {
          if (alive) setLoadError(errorMessage("deck_invalid"));
          return;
        }
        if (!alive) return;
        setDeck(parsed.deck);
        setIcons(parsed.icons);
        setLogo(parsed.logo);
      } catch {
        if (alive) setLoadError("Could not open this deck. Try again.");
      }
    })();
    void loadLogoStatus(setLogoStatus);
    void loadFeature(setFeatureOn);
    return () => {
      alive = false;
    };
  }, [deckPath]);

  // Save anything still waiting when the page is left.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (hasDeckPatch(pendingRef.current)) void sendPatchOnLeave(deckPath, pendingRef.current);
    };
  }, [deckPath]);

  if (!deckPath) {
    return (
      <>
        <h1 className="page-title">Deck look</h1>
        <p className="muted">No deck is chosen. Open a deck from the Daily page to change its look.</p>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <h1 className="page-title">Deck look</h1>
        <p className={`${styles.notice} ${styles.noticeError}`} role="alert">
          {loadError}
        </p>
      </>
    );
  }

  if (!deck || !logo) {
    return (
      <>
        <h1 className="page-title">Deck look</h1>
        <p className="muted">Opening the deck.</p>
      </>
    );
  }

  const firstSlide = deck.slides[0] ?? null;
  const channelName = deck.channel === "linkedin" ? "LinkedIn deck" : "Instagram deck";
  const renderBlocked = featureOn === false;

  function changeTheme(theme: DeckTheme) {
    if (!deck) return;
    const colors = applyThemePreset(deck.colors, deck.theme, theme, keepChanged);
    setDeck({ ...deck, theme, colors });
    queue({ theme, colors });
  }

  function changeColour(key: ColourKey, value: string) {
    if (!deck) return;
    setDeck({ ...deck, colors: { ...deck.colors, [key]: value } });
    queue({ colors: { [key]: value } });
  }

  function changeStyling(patch: Partial<Deck["styling"]>) {
    if (!deck) return;
    setDeck({ ...deck, styling: { ...deck.styling, ...patch } });
    queue({ styling: patch });
  }

  function changeIcons(on: boolean) {
    setIcons(on);
    queue({ icons: on });
  }

  function changeLogo(patch: Partial<LogoSettings>) {
    if (!logo) return;
    setLogo({ ...logo, ...patch });
    queue({ logo: patch });
  }

  async function makeImages() {
    if (!deck) return;
    setRender({ busy: true, files: null, error: null });
    const saved = await flush();
    if (!saved) {
      setRender({ busy: false, files: null, error: "Save the change first. Then try again." });
      return;
    }
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deck_path: deckPath, pdf: deck.channel === "linkedin" }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        renders?: string[];
        error?: { code?: string };
      };
      if (!res.ok) {
        if (json.error?.code === "feature_off") setFeatureOn(false);
        setRender({ busy: false, files: null, error: errorMessage(json.error?.code) });
        return;
      }
      setRender({ busy: false, files: (json.renders ?? []).map(fileNameOf), error: null });
    } catch {
      setRender({ busy: false, files: null, error: errorMessage(undefined) });
    }
  }

  return (
    <>
      <header>
        <h1 className="page-title">Deck look</h1>
        <p className="muted">{channelName}. Change how the slides look. Slide text is not edited here.</p>
        <p className="caption caption-key">{deckPath}</p>
      </header>

      <p
        className={`${styles.status} ${save.kind === "error" ? styles.statusError : ""} ${save.kind === "saved" ? styles.statusOk : ""}`}
        role="status"
        aria-live="polite"
      >
        {save.kind === "saving" ? "Saving" : null}
        {save.kind === "saved" ? "Saved" : null}
        {save.kind === "error" ? save.message : null}
      </p>

      <div className={styles.layout}>
        <div className={styles.previewColumn}>
          <DeckPreview
            slide={firstSlide}
            colours={deck.colors}
            corner={deck.styling.corner}
            card={deck.styling.card}
            padding={deck.styling.padding}
            icons={icons}
            iconColour={iconColour}
            logo={logo}
          />
          <p className="caption">Preview of the first slide. It does not make the images.</p>

          <div className={styles.group}>
            <button
              type="button"
              className={styles.renderButton}
              disabled={render.busy || renderBlocked}
              onClick={() => void makeImages()}
            >
              Make images
            </button>
            {renderBlocked ? (
              <p className={styles.notice} role="note">
                {errorMessage("feature_off")}
              </p>
            ) : null}
            {render.busy ? <p className="caption" role="status">Making images. This can take a minute.</p> : null}
            {render.error ? (
              <p className={`${styles.notice} ${styles.noticeError}`} role="alert">
                {render.error}
              </p>
            ) : null}
            {render.files ? (
              render.files.length > 0 ? (
                <ul className={styles.fileList} aria-label="Made images">
                  {render.files.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p className="caption">No image files were listed.</p>
              )
            ) : null}
          </div>
        </div>

        <div className={styles.controlColumn}>
          <LookControls
            theme={deck.theme}
            colours={deck.colors}
            corner={deck.styling.corner}
            card={deck.styling.card}
            padding={deck.styling.padding}
            icons={icons}
            iconColour={iconColour}
            keepChanged={keepChanged}
            onTheme={changeTheme}
            onKeepChanged={setKeepChanged}
            onColour={changeColour}
            onCorner={(value: Corner) => changeStyling({ corner: value })}
            onCard={(value: Card) => changeStyling({ card: value })}
            onPadding={(value: Padding) => changeStyling({ padding: value })}
            onIcons={changeIcons}
            onIconColour={setIconColour}
          />
          <LogoControls
            status={logoStatus}
            logo={logo}
            onChange={changeLogo}
            onLogoUploaded={() => void loadLogoStatus(setLogoStatus)}
          />
        </div>
      </div>
    </>
  );
}

async function loadLogoStatus(set: (status: LogoStatus) => void) {
  try {
    const res = await fetch("/api/logo");
    if (!res.ok) {
      set({ present: false });
      return;
    }
    const body = (await res.json()) as LogoStatus;
    set(body ?? { present: false });
  } catch {
    set({ present: false });
  }
}

async function loadFeature(set: (on: boolean | null) => void) {
  try {
    const res = await fetch("/api/features");
    if (!res.ok) return;
    const body = (await res.json()) as { switches?: { key: string; current: unknown }[] };
    const row = body.switches?.find((s) => s.key === "carousel_render");
    set(row?.current === true);
  } catch {
    // Left unknown. The render call still reports feature_off if it is switched off.
  }
}

// Sends changes still waiting when the page closes. Fire and forget.
function sendPatchOnLeave(deckPath: string, body: DeckPatch) {
  return fetch("/api/deck", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deck_path: deckPath, ...body }),
    keepalive: true,
  }).catch(() => undefined);
}
