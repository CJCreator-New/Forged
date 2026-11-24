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
- **Open gap.** The foundation code in `src/lib/features/flags.ts` imports the JSON at build time. That contradicts the decision above. Fix it in the next step by reading the file inside each flag function (with no side effects beyond the read).
