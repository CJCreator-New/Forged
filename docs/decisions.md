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
