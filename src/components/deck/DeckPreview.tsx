"use client";

import type { CSSProperties } from "react";
import type { LogoSettings } from "../../lib/pipeline/deck/extras";
import type { Deck } from "../../lib/schemas/deck";
import {
  cornerRadiusPx,
  logoCornerEdges,
  logoSizeFraction,
  paddingPx,
  SLIDE_WIDTH_PX,
  type Colours,
  type Card,
  type Corner,
  type Padding,
} from "./deckHelpers";
import styles from "./DeckPreview.module.css";

type Props = {
  slide: Deck["slides"][number] | null;
  colours: Colours;
  corner: Corner;
  card: Card;
  padding: Padding;
  icons: boolean;
  iconColour: string | null;
  logo: LogoSettings;
};

// Visual preview only. It shows the first slide with the deck's look and never renders a PNG.
// Slide text is read from the deck and is not editable here.
export default function DeckPreview({ slide, colours, corner, card, padding, icons, iconColour, logo }: Props) {
  if (!slide) {
    return <p className={styles.placeholder}>The first slide will show here once the deck is open.</p>;
  }

  const pad = (paddingPx(padding) / SLIDE_WIDTH_PX) * 100;
  const radius = (cornerRadiusPx(corner) / SLIDE_WIDTH_PX) * 100;
  const iconName = icons && slide.icon ? slide.icon : null;

  const vars = {
    "--deck-bg": colours.bg,
    "--deck-text": colours.text,
    "--deck-accent": colours.accent,
    "--deck-muted": colours.muted,
    "--deck-icon": iconColour ?? colours.accent,
    "--deck-pad": `${pad}cqw`,
    "--deck-radius": `${radius}cqw`,
    "--deck-icon-url": iconName ? `url("/icons/${iconName}.svg")` : "none",
  } as CSSProperties;

  // The first slide is the cover, so the logo shows here whenever it is switched on.
  const showLogo = logo.enabled;
  const edges = logoCornerEdges(logo.corner);
  const logoStyle = {
    width: `${logoSizeFraction(logo.size) * 100}cqw`,
    opacity: logo.opacity,
    [edges.horizontal]: "0",
    [edges.vertical]: "0",
  } as CSSProperties;

  return (
    <div className={styles.frame} style={vars} data-testid="deck-preview">
      <div className={styles.inner}>
        <div className={styles.card} data-card={card}>
          {iconName ? <span className={styles.icon} aria-hidden="true" /> : null}
          <h3 className={styles.title}>{slide.title}</h3>
          <span className={styles.rule} aria-hidden="true" />
          {slide.body ? <p className={styles.body}>{slide.body}</p> : null}
        </div>
      </div>
      {showLogo ? (
        <span className={styles.logo} style={logoStyle} aria-hidden="true">
          Logo
        </span>
      ) : null}
    </div>
  );
}
