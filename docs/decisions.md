# Decisions and assumptions

## Foundation step

- **Docs location.** The spec docs were at the project root. Moved into `docs/` to match `Claude.md`.
- **Git.** Repository initialised with a baseline commit of the docs. Work for this step is on a worktree branch.
- **Writes rule.** "Writes stay inside content/, templates/, config/" is read as applying to what the running app writes. Scaffolding creates `src/`, `package.json`, and similar.
- **Placeholders.** Empty folders from doc 04 section 2 (and the `perf`, `assets`, `features` folders from section 9) hold a `.gitkeep`. `content/assets/` is git-ignored as required, so it gets no placeholder file.
- **No model config yet.** `config/models.json` and `config/channels.json` are not created. Model IDs must be checked before use, not guessed.
- **Feature defaults.** Read from doc 04 section 9. Kept in `src/lib/features/defaults.ts` so the settings page can show default and current values. A test checks they match `config/features.json`.
- **Flags are static.** `flags.ts` imports the JSON at build time, so there is no runtime file access.
- **Path safety.** A path is accepted only if it resolves inside `content/`. Symlinks inside `content/` are not checked yet.
- **Packages.** `gray-matter` and `vitest` were named in the request. `@types/node` moved from `^20` to `^24` so it matches Vitest's requirement and the Node 24 install.
- **Dev server.** `next dev -H 127.0.0.1 -p 3000`.

## Domain model session

- **Switch reads (decided).** Feature switches are read fresh on each call, so an edit takes effect without a restart (ADR 0005).
- **Facebook has no Deck in v1 (decided).** Facebook Posts are text or image posts only. This drops `facebook-deck.json` from the doc 04 folder layout. Doc 04 needs updating to match.
- **Humanise keeps both texts (decided).** Humanised text is the body. Raw text is saved beside it as `<post>.raw.md`.
- **Pillar changes mark Posts stale (decided).** Adapted Posts are flagged, never overwritten. Regeneration is per Post.
- **Trend failures stop (decided).** No silent fallback to plain angles.
- **Performance counts only filled reach (decided).** Rows without a reach number stay in the Log but do not count toward 20.
- **Missing key blocks the task (decided).** The screen names the missing key. No other provider is tried silently.
- **Local guard checks Host too (decided, ADR 0008).**
- **Variants on demand (decided).** Generated per Post with a button, not for every draft.
- **Week ZIP holds everything (decided).** All Posts and Decks, each marked with its status, plus a README.
- **Dashes and emojis (decided, stricter than doc 03).** Em dash U+2014 and en dash U+2013 are hard failures. A double hyphen `--` is a soft warning. Emojis use full Unicode emoji ranges, including skin tones and joined sequences.
- **Name check (decided).** HR and people-management posts get a soft review flag for capitalised word pairs that do not start a sentence. No new dependency.
- **Voice profile (decided).** A regenerated profile is saved as `voice.new.md`. An edited `voice.md` is never overwritten.
- **Doc fixes to make in the build.** Doc 03 H2 should list en dash too. Doc 04 should say `channel:` not `platform:`, and drop the Facebook deck file.
- **Performance loop stays on (decided).** `features.json` keeps `enabled: true`. Ranking waits for 20 posts. PRD wording gets corrected.
- **Facebook is text only in v1 (decided).** No images. Doc 03 image rules are parked for v2.
- **content/ is git-ignored (decided).** Posts, voice, logs, and reach numbers never enter a repo.
- **Milestones follow doc 05 v0.2 (decided).** M1 to M4 as written there.
- **Call counter (decided).** Model calls counted per provider per day, shown in settings, no hard cap.
- **Humanise override (decided).** Per-post `humanise: on|off|inherit` in frontmatter.
- **Logging (decided).** One logger, records only model, tokens, and status. A test checks no key value appears.
- **One caption per Post in v1 (decided).** Instagram per-slide captions are unconfirmed and not used.
- **LinkedIn limit (decided).** 3,000 characters is the hard max, confirmed from LinkedIn's help page. Our 600 to 1,300 body range is a soft target and is labelled as our own choice.
- **Instagram 2,200 caption limit and 1080 x 1350 carousel size.** Consistent across secondary sources only. Confirm before the build.
- **Dynamic model selection (decided by you, details pending).** Free models from OpenRouter by default. A paid key lets the user choose any model. The key is verified when entered. This amends ADR 0002, which assumed a fixed `config/models.json`. Key check: read the key's status with no model call, which shows free-only or paid. The endpoint is confirmed at build time. List refresh: fetched every time the settings page opens (your choice, not the recommended daily refresh). Note the network call on each open.
- **Free model IDs (checked, changing).** Top of the OpenRouter free collection at check time: `nvidia/nemotron-3-ultra-550b-a55b:free`, `baidu/ernie-5.5-flash-preview:free`, `nvidia/nemotron-3.5-super-vl:free`, `nvidia/nemotron-3.5-lightning:free`. Context length not shown. Must be rechecked at build time.
- **Topics are editable (decided).** `content/topics.md` starts with the seven topics. The glossary is corrected to match.
- **Switches editable in v1 (decided, ADR 0005 amended).** The settings screen writes `config/features.json`. Built in M4.
- **Search provider changed (decided, ADR 0009).** Brave is dropped because it requires a card. Trend search uses Tavily first (1,000 free credits a month, no card) and Firecrawl as backup (1,000 free credits a month, no card). Each has its own monthly cap in credits. You chose to use both. Tavily-first ordering is my default; say if you want the reverse. Firecrawl's key header is not confirmed on its pricing and billing pages, so it is checked against its API reference at build time.
- **Brave monthly cap of 900 (superseded).** Brave now gives about $5 of credit (roughly 1,000 queries) and needs a card on file. The app stops trend search at 900 queries a month. The cap is editable in settings. This replaces the PRD's "free tier" assumption (D5), which needs updating. Brave's rate limit differs by source (1 query per second on the free plan per one source), so pace requests to 1 per second until the dashboard confirms the number.
- **Time zone (assumed, per your India default).** Timestamps include the local offset (+05:30). Day boundaries use local time.
- **Writing styles (decided).** Four presets ship as editable files in `config/styles/`: conversational, analytical, storytelling, direct. Chosen per post, with a default set on the Day or Week. Styles never add facts. Voice profile still applies.
- **Lengths (decided).** Tiers: micro, short, medium (default), long, extended, plus custom (exact target). Ranges per channel go in `config/channels.json`. Numbers still to propose and approve. Every tier stays within the channel hard max.
- **Enhance (decided).** Button on a post. The user picks an aim (sharper hook, more concrete, shorter, warmer) and may add a line. Keeps facts, passes the linter, saves the previous text as a version (ADR 0007). Separate from the humanise pass.
- **Scope (decided).** Style and enhance are per post. A default can be set on the Day or Week.
- **Open gap.** The foundation code in `src/lib/features/flags.ts` imports the JSON at build time. That contradicts the decision above. Fix it in the next step by reading the file inside each flag function (with no side effects beyond the read).
