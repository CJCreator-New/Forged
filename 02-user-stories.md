# Postline: User stories v0.2

Each story has acceptance criteria. "Done" means every criterion passes in a local run.

## E1. Setup

**S1.1 Keys.** As a user, I add API keys to `.env.local` so the app can call models and search.
- Missing keys show a clear message in the UI, naming the key, not the value.
- Keys never appear in the browser, logs, or exported files.

**S1.2 Model choice.** As a user, I pick which model handles each task (ideas, drafts, adapting, humanising) from a config file.
- A fallback list is used if the first model is rate-limited.
- The model name used for each post is saved in its frontmatter.

**S1.3 Voice setup.** As a user, I paste 3 to 5 writing samples and get a `voice.md` profile.
- The profile lists tone, sentence rhythm, words to use, words to avoid, and banned characters.
- I can edit `voice.md` in any editor. The app reads the saved file each time.

## E2. Ideas

**S2.1 Topic to angles.** As a user, I enter a topic or rough thought and get 5 to 10 angles.
- Each angle has a title, 3 hook variants, a recommended format (text or carousel), and a "why this could travel" note.
- Output is structured JSON, validated before display.

**S2.2 Trend suggestions.** As a user, I can turn on trend mode for a topic.
- The app runs a Brave Search query, shows the source list, and then generates angles from it.
- Each angle that uses a trend links to its source URL.
- With trend mode off, no search call is made.

**S2.3 Pick an angle.** As a user, I choose one angle, which becomes the day's brief.

## E3. Drafting

**S3.1 Daily set.** As a user, I get one post per channel (LinkedIn, Instagram, Facebook) from the chosen angle.
- Each draft follows the channel spec in doc 03.
- The three drafts are generated in parallel.

**S3.2 Week from a brief.** As a user, I enter a campaign brief and get 7 days of posts.
- A long-form pillar draft is written first. Each day's posts are adapted from it.
- The pillar draft is saved as a file so I can edit it. Adapted posts regenerate from it on request.

**S3.3 Humanise pass.** As a user, every draft gets an AI-tell pass before I see it.
- The pass removes patterns from doc 03 section 4 without changing facts.
- The before and after versions are both saved, so I can compare.

## E4. Slides

**S4.1 Carousel outline.** As a user, a carousel angle produces a slide list (type, title, body, icon).
- Target 7 to 10 slides. Each slide has at most 3 lines of body text.

**S4.2 Render.** As a user, I render the slide list to PNG at the sizes in doc 03.
- Rendering happens locally. Nothing is sent to a third party except the model calls already in use.

**S4.3 Themes and colours.** As a user, I pick a theme and change its colours.
- Three built-in themes. Colour tokens (background, text, accent, muted) are editable.
- Changes re-render the deck without touching the text.

**S4.4 Icons.** As a user, I search and pick icons from a bundled icon set, offline.
- Each slide can have one icon. Icon colour follows the accent colour unless overridden.

## E5. Quality

**S5.1 Linter.** As a user, every draft is checked against the hard and soft rules in doc 03.
- Hard failures (emojis, em dashes, medical efficacy claims, engagement bait) block export until fixed.
- Soft warnings (AI-tell words, over-length hooks) show inline and do not block.

**S5.2 Review checkbox.** As a user, healthcare and HR drafts need a manual review tick before export.

**S5.3 Edit tracking.** As a user, I rate each post at publish time: as-is, light edits, or rewrite.
- The rating is saved to `content/log.md` and feeds the 30-day goal check.

## E6. Export

**S6.1 Post export.** As a user, I export one post as a markdown file with the caption, hashtags, and alt text.

**S6.2 Deck export.** As a user, I export a carousel as a PDF, or as individual PNG slides.

**S6.3 Week export.** As a user, I export a whole week as a ZIP: posts, decks, and a README listing each file.

## E7. Week planner

**S7.1 Week view.** As a user, I see 7 days with one card per post, grouped by channel.
- Each card shows status: draft, reviewed, rendered, exported.

**S7.2 Regenerate one.** As a user, I regenerate one post without touching the others.

## E8. Settings

**S8.1 Keys and models.** As a user, I see which keys are set and which models each task uses, without seeing key values.

**S8.2 Local only.** As a user, the server binds to 127.0.0.1 only, so nothing on my network can reach it.

---

## v0.2 changes

Existing stories gain these rules:
- **S2.2 Trend mode** is off by default. It's enabled per session from the feature switch.
- **S3.3 Humanise pass** is on by default. Switchable per session and per post. When off, the linter still runs.
- **S4.2 Render** runs only for posts with carousel rendering turned on.
- **S4.3 Themes** now also covers corner radius and card style (see E12).

## E9. Feature switches

**S9.1 Switch on or off.** As a user, I turn each optional feature on or off in `config/features.json` or from the settings screen.
- A switched-off feature runs no code, makes no model call, and launches no browser.
- The settings screen shows each switch's default and current value.

**S9.2 Defaults.** As a user, on first run the switches match the defaults in doc 01 section 4a.

## E10. Post variants

**S10.1 Generate variants.** As a user, each post generates 2 or 3 variants (the count is a switch).
- Variants differ only in hook or angle. The facts match the selected post.
- Each variant is linted separately.

**S10.2 Pick a variant.** As a user, I select one variant as the post's body. Unselected variants stay saved in `variants/`.

**S10.3 Compare.** As a user, I see the variants side by side with their lint results, so I can choose quickly.

## E11. Post lengths

**S11.1 Choose a length.** As a user, I choose short, medium, or long for each post. The length sets the body range from doc 03 section 6.

**S11.2 Change length.** As a user, changing the length regenerates that post's body from the pillar draft and keeps its hook options.
- The hook limit stays the same across lengths.
- The previous body is kept as a saved version.

## E12. Themes, styling, and icons

**S12.1 Themes.** As a user, I pick one of the three themes for a deck. The choice applies to every slide in that deck.

**S12.2 Styling.** As a user, I set corner radius (square, rounded, very rounded), card style (flat, outlined, shadow), and padding (small, medium, large) for each deck.

**S12.3 Icons.** As a user, I can turn icons on for a deck. When on, each slide can have one icon from the bundled set. Icons are off by default.
- Icon colour follows the accent colour unless overridden.

## E13. Logo slot and styling

**S13.1 Upload a logo.** As a user, I place a PNG or SVG file at `content/assets/logo.png` or `logo.svg`.
- Files of other types are rejected with a clear message.
- Files over 2 MB are rejected.

**S13.2 Placement.** As a user, I set the logo's corner (top-left, top-right, bottom-left, bottom-right), size (small, medium, large), and opacity.

**S13.3 Where it appears.** As a user, the logo appears on cover and CTA slides by default. A switch shows it on every slide.

**S13.4 No logo.** As a user, if no logo file exists, the logo slot is hidden and nothing errors.

## E14. Performance loop

**S14.1 Log data.** As a user, I record each post's edit rating (already in S5.3) and enter weekly reach and follower numbers in `content/log.md`.

**S14.2 Ranking.** As a user, once 20 posts are logged, the angle list ranks options by the average reach of past posts with the same topic and format.
- Each rank shows its reason, such as "your last 4 AI carousels averaged 1,200 reach."
- A topic and format pair needs at least 3 logged posts before it can be ranked.

**S14.3 Before the threshold.** As a user, before 20 posts the angle list is unranked, and the screen says how many posts are still needed.

**S14.4 Local only.** As a user, the ranking runs from my log file on my machine. No data leaves the app.

**S14.5 Reset.** As a user, I can clear the performance data without deleting my posts.
