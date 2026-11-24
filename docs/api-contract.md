# Postline: API contract v1

All routes are local only. Each route rejects any request whose client address is not 127.0.0.1, or whose Host header is not `127.0.0.1:3000` or `localhost:3000` (ADR 0008). Responses never contain key values (ADR 0004). Every JSON response is validated with a zod schema from `src/lib/schemas/` before it leaves the server.

Errors use one shape: `{ "error": { "code": string, "message": string, "key"?: string } }`. A missing key returns `code: "missing_key"` with the key name, never its value.

## Settings and keys

| Route | Method | Request | Response |
|---|---|---|---|
| `/api/settings` | GET | none | `{ switches, keys: [{ name, set }], models: { tasks, free_only, selectable_models }, counters: { brave_month, model_calls_today: { [provider]: n } }, brave_cap: 900 }` |
| `/api/features` | GET | none | `{ switches: [{ key, default, current }] }` |
| `/api/features` | PATCH | `{ key, value }`, validated against the switch schema | `{ key, value }`. Writes `config/features.json` only. |
| `/api/keys/check` | POST | `{ provider: "openrouter" }` | `{ valid, is_free_tier, limit_remaining }`. Calls `GET https://openrouter.ai/api/v1/key`. No model call. |
| `/api/models` | GET | `?refresh=1` | `{ fetched_at, models: [{ id, name, free }] }`. Fetched every time settings opens (decision). |

## Ideas and drafts (daily)

| Route | Method | Request | Response |
|---|---|---|---|
| `/api/ideas` | POST | `{ topic, trend_mode }` | `{ angles: Angle[], trend_sources?: [{ url, title }] }`. Saved to `content/ideas/`. Trend failure returns `code: "trend_failed"` and stops. |
| `/api/pick` | POST | `{ idea_file, angle_index, default_style? }` | `{ day_path, posts: PostFrontmatter[] }`. Creates the Day with one post per channel. |
| `/api/draft` | POST | `{ day_path, channel, length, style, humanise }` | `{ post_path, lint }`. Writes the post and `<channel>.raw.md` when humanised. |
| `/api/variants` | POST | `{ post_path, count: 2 \| 3 }` | `{ variants: [{ variant_index, path, lint }] }`. On demand only. |
| `/api/select-variant` | POST | `{ post_path, variant_index }` | `{ post_path }`. Old body kept in `variants/`. |
| `/api/enhance` | POST | `{ post_path, aim, note? }` | `{ post_path, previous_path, lint, facts_preserved }`. |
| `/api/lint` | POST | `{ post_path }` | `{ hard: string[], soft: string[] }` |
| `/api/length` | POST | `{ post_path, length, custom_target? }` | `{ post_path, previous_path }`. Hook options kept. |
| `/api/humanise` | POST | `{ post_path }` | `{ post_path, raw_path }`. Only when the humanise switch or post override allows. |

## Carousel

| Route | Method | Request | Response |
|---|---|---|---|
| `/api/deck` | POST | `{ post_path }` | `{ deck_path }`. Generates and validates P6 JSON. |
| `/api/deck` | PATCH | `{ deck_path, theme?, colors?, styling?, icons?, logo? }` | `{ deck_path }`. Changes styling only, never slide text. |
| `/api/render` | POST | `{ deck_path, pdf: boolean }` | `{ renders: string[], alt_path }`. Refused when carousel rendering is off for the post. |
| `/api/logo` | GET | none | `{ present, format?, width? }` |
| `/api/logo` | POST | multipart file | `{ accepted, reason? }`. Validated per doc 03 section 9. |
| `/api/icons` | GET | `?q=` | `{ icons: string[] }`. Bundled set, offline. |

## Week

| Route | Method | Request | Response |
|---|---|---|---|
| `/api/week` | POST | `{ brief }` | `{ week_path }`. Creates `brief.md` and the Week folder. |
| `/api/pillar` | POST | `{ week_path }` | `{ pillar_path }`. Writes `pillar.md`. |
| `/api/pillar` | PUT | `{ week_path, body }` | `{ stale_posts: string[] }`. Saves the edited pillar and marks posts stale. Never overwrites post bodies. |
| `/api/week/adapt` | POST | `{ week_path }` | `{ posts: [...] }`. Adapts all 21 posts from the pillar, skipping posts the user has edited. |
| `/api/week/view` | GET | `?week=` | `{ days: [{ date, posts: [{ path, channel, status, stale, lint }] }] }` |
| `/api/export/week` | GET | `?week=` | ZIP stream with README |
| `/api/export/post` | GET | `?post=` | markdown file with caption, hashtags, alt text |
| `/api/export/deck` | GET | `?deck=&kind=pdf\|png` | PDF or PNG set |

## Performance

| Route | Method | Request | Response |
|---|---|---|---|
| `/api/perf` | GET | none | `{ logged, needed, ranked: false \| Group[] }`. Groups carry a reason string. |
| `/api/perf/log` | POST | `{ row }` | `{ appended: true }`. Validated by the log row schema. |
| `/api/perf` | DELETE | `{ confirm: true }` | `{ cleared: true }`. Clears performance columns only, never posts. |

## Changes made after wave 2 (lead)

- `GET /api/post?path=` added: returns `{ path, frontmatter, body }`. Read only. Refuses paths outside content/ with `bad_path` (400).
- `POST /api/ideas` returns `idea_file`, which `/api/pick` needs.
- `POST /api/pick` returns `posts: [{ channel, post_path }]`. It creates no post files; drafts are written by `/api/draft`.
- `POST /api/enhance` aim ids are `sharper-hook`, `more-concrete`, `shorter`, `warmer`. A fact check that drops a number or name returns `200` with `{ facts_preserved: false, code: "facts_changed", missing: [...] }` and saves nothing. Sentence-opening words are not counted as names.
- `/api/select-variant` keeps the old body in `versions/`, not `variants/`.
- `angle_index` is 0-based.
- Renders are per channel: `weeks/<week>/days/<date>/renders/<channel>/`. Alt text is `renders/<channel>/alt.txt`. Two decks on one day never share a folder.
- Deck files keep `icons` and `logo` settings beside the deck fields in the same JSON file (read by `src/lib/pipeline/deck/extras.ts`). `DeckSchema` itself does not hold them.
- `POST /api/render` returns `403 feature_off` when carousel rendering is off, and `422 not_carousel` when the post is not a carousel. No browser starts in either case.
- Error codes used across routes: `missing_key` (503, names the key), `voice_missing`, `trend_failed`, `trend_cap_reached`, `hard_lint_failed`, `review_required`, `user_edited`, `facts_changed`, `bad_aim`, `bad_path`, `post_not_found`, `no_deck_for_channel`, `not_rendered`, `feature_off`, `not_carousel`.
- `GET /api/export/post` also accepts `review_confirmed=true`.
- `GET /api/pillar?week=` returns `{ body }`, or `404 pillar_not_found`.
- `POST /api/week` takes `week` (or `week_id`), an optional `start_date` (defaults to that week's Monday), and a brief with `call_to_action`.
- `GET /api/week/view` posts include `review_required` and `lint: { hard, soft }` counts.
- `POST /api/draft` on an existing post regenerates it. It returns `409 user_edited` when you have edited the post, and makes no model call in that case. A week-made day has no brief file, so regeneration uses the post's own frontmatter.
- `GET /api/deck?path=` returns `{ path, deck, icons, logo }` for the deck editor.
- `GET /api/perf` returns `enabled`, `threshold`, `min_group`, and `rows` alongside the ranking.
- `POST /api/perf/log` returns `replaced` when a row is updated. New codes: `duplicate_post_id`, `post_not_found`.
- Search services: trend search tries Tavily first, then Firecrawl. Usage is reported per service in credits as `counters.search_month`. Brave is no longer used.

## Ownership

- Routes in `src/app/api/**` are owned by the UI and pipeline builders named in `docs/06-build-plan.md`.
- Shapes in this document change only through the lead. Builders that need a change report it to the lead.
