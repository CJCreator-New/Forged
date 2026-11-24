# Postline: Voice, channel, slide, and linter spec v0.2

## 1. Voice profile (`content/voice.md`)

Built from writing samples you paste in. You have no past posts, so the first profile comes from a few paragraphs of anything you've written (email, document, README). Replace it with real post samples once you've published a few.

Template:

```markdown
# Voice

## Tone
- Warm, technical, formal. (From your answer.)

## Audience
- Peers, hiring managers, product and people leaders. Assumed to know the basics.

## Sentence rules
- Average sentence length: [filled from samples]
- Contractions: [yes/no, from samples]
- Opening style: [from samples]

## Use these
- [phrases and words from samples]

## Never use
- Emojis
- Em dashes (the long dash)
- Engagement bait ("comment YES", "tag someone who...", "like if you agree")
- Stock AI words: leverage, delve, game-changer, unlock, in today's fast-paced world, here's the thing

## Samples
- [3 to 5 pasted samples, short]
```

Rules for the profile:
- It describes how you write. It never includes names, employers, or private details from the samples.
- The app reads it fresh on every generation call. Editing it changes the next output.

## 2. Channel specs

Limits below are the working defaults. Check each platform's current limits before the build starts, because these change.

| | LinkedIn | Instagram | Facebook |
|---|---|---|---|
| Hook | First ~200 characters. Visible before "see more" | First ~125 characters. Visible before "more" | First line |
| Body target | 600 to 1,300 characters | Caption 150 to 600 characters | 50 to 150 words |
| Hard max | 3,000 characters | 2,200 characters | Practical limit, no hard cap in the app |
| Hashtags | 0 to 3 | 3 to 5, at the end | 0 to 2 |
| Format | Short paragraphs, one blank line between them | Line breaks, short lines | Plain paragraphs |
| Carousel | PDF document post, 1080 x 1350 px, 7 to 10 slides | Carousel post, 1080 x 1350 px, 7 to 10 slides | Image post, 1080 x 1350 px, 1 to 5 images |
| Question CTA | Max one, at the end | Max one | Max one |

Rules that apply to all channels:
- One idea per post. If the idea needs two posts, the angle is too big.
- Adapted posts reuse the pillar draft's facts. No new claims appear in an adaptation.
- Every image carries alt text, generated from the slide's title and body.

## 3. Slide spec and themes

### Slide schema (JSON, validated before render)

```json
{
  "deck_id": "2026-11-24-ai-ops-01",
  "channel": "instagram",
  "size": { "w": 1080, "h": 1350 },
  "theme": "dark-tech",
  "colors": { "bg": "#0b1220", "text": "#f5f7fa", "accent": "#4fd1c5", "muted": "#8a94a6" },
  "slides": [
    { "type": "cover", "title": "Short title", "body": "One line", "icon": "cpu" },
    { "type": "point", "title": "Point", "body": "Up to 3 short lines", "icon": "users" },
    { "type": "stat", "title": "42%", "body": "What it measures", "icon": "bar-chart" },
    { "type": "cta", "title": "Question for the reader", "body": "", "icon": "message-circle" }
  ]
}
```

Slide types: `cover`, `point`, `stat`, `quote`, `cta`.

Limits: at most 3 body lines per slide, 60 characters per title line, and 10 slides per deck.

### Themes
- **Clean light:** white background, dark text, one accent.
- **Dark tech:** dark navy background, light text, bright accent.
- **Warm paper:** off-white background, brown-black text, muted orange accent.

Each theme is a set of colour tokens (`bg`, `text`, `accent`, `muted`) that you can edit in the UI. Fonts: Inter (SIL Open Font License), bundled locally so rendering works offline.

### Icons
Lucide icon set (ISC licence), bundled locally. The picker is searchable. Icon colour follows `accent` unless overridden.

### Render
- Headless Chromium via Playwright renders each slide's HTML template at the channel size.
- Output: one PNG per slide, one PDF per deck (for LinkedIn documents), and `alt.txt` per deck.

## 4. Humanise pass (rules from the humanizer skill)

The AI-tell pass runs after drafting, before the linter. It targets:
1. Not-X-but-Y contrasts, such as "It's not about X, it's about Y."
2. One-line closers that repeat the point.
3. Forced triads (three parallel items when two or four fit better).
4. Em dashes and dash-heavy rhythm (already a hard rule).
5. Inflated claims: "pivotal," "transformative," "revolutionary."
6. Stock AI words (see the "never use" list).
7. Bold labels and headers inside short posts.

The pass returns the rewrite and a list of what it changed. It must keep every fact, number, and name. A changed fact fails the check.

## 5. Linter rules

### Hard rules (block export)
| ID | Rule | Check |
|---|---|---|
| H1 | No emojis | Unicode emoji ranges, including skin tones and ZWJ sequences |
| H2 | No em dashes | Character U+2014 |
| H3 | No engagement bait | Phrases such as "comment YES", "tag a friend", "share if you agree", "like if" |
| H4 | No medical efficacy or treatment claims | Patterns: "cures", "guaranteed results", "clinically proven" (without a cited source), "replaces your doctor" |
| H5 | Character limits | Per channel, from section 2 |
| H6 | Slide limits | Per section 3 |

### Soft rules (warn, don't block)
| ID | Rule |
|---|---|
| S1 | AI-tell words from the "never use" list |
| S2 | Hook longer than the visible limit |
| S3 | More than one question CTA |
| S4 | Hashtags over the channel limit |
| S5 | Possible named person or employer in HR or people-management topics (flag for review) |
| S6 | Stat in a post with no source noted |

### Manual checkpoints
- Healthcare and HR posts need a review tick before export (S5.2).
- Any stat needs its source confirmed by you before publishing.

---

## v0.2 additions

## 6. Post lengths and variants

### Length tiers (body only; the hook limit never changes)

| Channel | Short | Medium (default) | Long |
|---|---|---|---|
| LinkedIn | 300 to 600 characters | 600 to 1,300 characters | 1,300 to 2,000 characters |
| Instagram caption | 80 to 150 characters | 150 to 600 characters | 600 to 1,200 characters |
| Facebook | 20 to 50 words | 50 to 150 words | 150 to 300 words |

Hard maximums from section 2 still apply. A long LinkedIn post is capped at 2,000 characters here, well under the 3,000 limit, to leave room for hashtags and formatting.

### Variants
- Each post generates 2 or 3 variants. The default is 2.
- Variants differ only in hook or angle. Every fact, number, and name matches the selected post.
- Each variant is checked by the linter separately, and hard failures block that variant only.
- The selected variant becomes the post body. Others stay in `variants/` for reuse.

## 7. Carousel rendering (opt-in per post)

- Rendering runs only when carousel rendering is on for that post. Turning it on does not render existing posts automatically.
- Output: one PNG per slide at the channel size, a PDF for LinkedIn documents, and `alt.txt` with alt text for each slide.
- Rendering uses the chosen theme, styling, icons, and logo. If any of these is off, it's left out cleanly, with no placeholder shapes.

## 8. Themes, styling, and icons (opt-in)

### Themes
The three themes from section 3 stay the same. Each theme is a set of colour tokens (`bg`, `text`, `accent`, `muted`) that you can override per deck.

### Styling tokens (per deck)

| Token | Options | Default |
|---|---|---|
| Corner radius | Square (0 px), rounded (12 px), very rounded (24 px) | Rounded |
| Card style | Flat, outlined (2 px border), shadow (soft drop shadow) | Flat |
| Padding | Small (48 px), medium (72 px), large (96 px) | Medium |

Font is Inter in v1. A font picker is out of scope.

### Icons
- Off by default. Turn on per deck.
- Lucide icon set, bundled offline. One icon per slide at most.
- Colour follows `accent` unless overridden.

## 9. Logo slot and styling

- **File:** `content/assets/logo.png` or `logo.svg`. Maximum 2 MB. PNG must be at least 400 px wide. Other formats are rejected.
- **Corner placement:** top-left, top-right, bottom-left, bottom-right.
- **Size:** small (10% of slide width), medium (15%), large (20%).
- **Opacity:** 60% to 100%, default 100%.
- **Safe margin:** 60 px from each edge, so the logo never crosses the padding.
- **Where it shows:** cover and CTA slides by default. A switch shows it on every slide.
- **Off by default.** If no file exists, the slot is hidden and no error appears.
- **Responsibility:** you store only a logo you have rights to use. The app doesn't check trademarks.

## 10. Humanise pass (on by default)

- Runs after drafting and before the linter, using the rules in section 4.
- Switchable per session and per post.
- When the pass is on, both the raw and the humanised versions are saved, so you can compare.
- When the pass is off, the linter still runs.

## 11. Trend mode (off by default)

- Enabled per session.
- Brave Search returns up to 5 results per query. Result URLs are saved with the ideas file.
- Settings show how many search calls the session has used, so you can stay inside the free tier.

## 12. Performance loop

**Inputs:** `content/log.md` only. Each row has the post ID, platform, topic, format, length, edit rating, and reach.

**Threshold:** ranking turns on after 20 logged posts. Before that, the angle list is unranked and the screen says how many posts are still needed.

**Ranking rule:**
1. Group logged posts by topic and format.
2. Discard any group with fewer than 3 posts.
3. Score each group by average reach. Break ties with the average edit rating (as-is scores highest).
4. Show each angle's reason, for example "your last 4 AI carousels averaged 1,200 reach."

**Limits:** the loop ranks what you've already done. It doesn't predict viral posts, and it doesn't use any external data.

**Reset:** clears the log's performance columns without deleting posts.
