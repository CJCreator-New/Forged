# Postline: Architecture and prompt library v0.2

## 1. Stack

- **App:** Next.js (App Router), TypeScript, Tailwind CSS. Runs with `npm run dev` on 127.0.0.1:3000.
- **Storage:** markdown files with YAML frontmatter under `content/`. No database in v1.
- **Model calls:** a server-side gateway. OpenRouter is the default. Anthropic and OpenAI are optional adapters.
- **Search:** Brave Search API, called only in trend mode.
- **Rendering:** Playwright with headless Chromium. Slide HTML lives in `templates/`.
- **Export:** Node `archiver` for ZIP, Playwright PDF for decks.
- **Icons and fonts:** Lucide and Inter, bundled in `public/`.

Why not Supabase: there's one user, one machine, and no sync requirement. Supabase would add RLS and auth work with nothing gained. Revisit it if you ever want the app hosted.

## 2. Folder layout

```
postline/
  .env.local              # keys. Git-ignored. Never committed
  .gitignore
  config/
    models.json           # model per task + fallback list
    channels.json         # limits from doc 03, editable
  content/                # all your data. Plain files
    voice.md
    topics.md             # the seven topics, editable
    log.md                # manual reach, time, and edit-rating log
    ideas/YYYY-MM-DD-slug.md
    weeks/YYYY-Www/
      brief.md
      pillar.md           # long-form draft
      days/YYYY-MM-DD/
        linkedin.md
        instagram.md
        facebook.md
        instagram-deck.json
        facebook-deck.json
        renders/          # PNGs and PDF, generated
  templates/              # slide HTML templates per theme
  public/fonts/           # Inter
  public/icons/           # Lucide SVG set
  src/
    app/                  # pages and API routes
    lib/
      gateway/            # model adapters and fallback
      pipeline/           # ideas, pillar, adapt, humanise, lint
      linter/             # rules from doc 03 section 5
      render/             # Playwright slide renderer
      store/              # read and write content files
      schemas/            # zod schemas for JSON outputs
```

## 3. File formats

### Post file (`linkedin.md`)
```markdown
---
id: 2026-11-24-linkedin
platform: linkedin
status: draft            # draft | reviewed | rendered | exported
topic: AI
angle: "Ops teams are automating the wrong step"
format: text             # text | carousel
model: openrouter/<model-id>
created: 2026-11-24T09:00:00+05:30
edit_rating:             # as-is | light | rewrite, set at publish
review_required: false   # true for healthcare and HR
lint:
  hard: []
  soft: []
---

[post body]

Hashtags: #...
Alt text: ...
```

### Idea file
Frontmatter: `topic`, `created`, `trend_sources` (URLs, if used), `model`. Body: the angles as JSON, plus your pick.

### Log (`content/log.md`)
One row per post: date, platform, minutes spent, edit rating, and weekly reach and follower numbers entered by hand.

## 4. Gateway and config

`config/models.json`:
```json
{
  "tasks": {
    "ideas":     { "primary": "openrouter:<free-model-id>", "fallback": ["openrouter:<model-2>", "anthropic:<model>"] },
    "pillar":    { "primary": "openrouter:<free-model-id>", "fallback": ["openrouter:<model-2>"] },
    "adapt":     { "primary": "openrouter:<free-model-id>", "fallback": ["openrouter:<model-2>"] },
    "slides":    { "primary": "openrouter:<free-model-id>", "fallback": ["openrouter:<model-2>"] },
    "humanise":  { "primary": "openrouter:<free-model-id>", "fallback": [] }
  }
}
```

Rules:
- Model IDs are placeholders. Pick the current free models on OpenRouter at build time and test each one on the same brief.
- On a 429 or timeout, move to the next fallback and record it in the post frontmatter.
- The gateway returns `{ text, model, usage }`. JSON outputs are validated with zod, and a failed validation triggers one retry before an error is shown.

## 5. Pipeline

**Daily flow**
1. Input: topic or rough thought, trend mode on or off.
2. If trend mode is on: Brave search, then top results are passed to the ideas prompt.
3. Ideas prompt returns 5 to 10 angles as JSON. Saved to `content/ideas/`.
4. You pick one angle.
5. Fan out in parallel: LinkedIn, Instagram, and Facebook drafts, plus the Instagram deck and the Facebook deck if the format is carousel.
6. Each draft goes through the humanise pass.
7. Each result goes through the linter. Hard failures block export.
8. You review, rate, and export.

**Week flow**
1. Input: campaign brief (goal, audience, key points, CTA, optional link).
2. Pillar prompt writes the long-form draft. Saved to `pillar.md`.
3. Seven days of adaptation run in parallel, each producing three posts.
4. Humanise and lint run per post.
5. Decks are generated and rendered for carousel days.
6. Week view shows all 21 posts (plus decks) with status.

## 6. API routes (local only)

| Route | Method | Purpose |
|---|---|---|
| `/api/ideas` | POST | Topic in, angles out |
| `/api/pick` | POST | Save the chosen angle, start daily drafts |
| `/api/draft` | POST | Draft one post or a set |
| `/api/humanise` | POST | AI-tell pass on one post |
| `/api/lint` | POST | Run linter, return hard and soft results |
| `/api/deck` | POST | Generate slide JSON, validate, save |
| `/api/render` | POST | Render a deck to PNG and PDF |
| `/api/export/[week]` | GET | ZIP of a week |
| `/api/settings` | GET | Key presence (true or false only) and model config |

All routes check that the request came from 127.0.0.1. Responses never include key values.

## 7. Prompt library

Every prompt starts with the voice file contents and the channel spec for the target platform. Every prompt ends with: "Do not use emojis, em dashes, or engagement-bait phrases. Do not invent facts, numbers, or sources."

**P1 Ideas**
```
Topic: {{topic}}
Trend context (may be empty): {{trend_items}}
Task: return 5 to 10 content angles for a professional audience.
For each angle return JSON: { "title", "hooks": [3 strings], "format": "text" | "carousel", "why_it_could_travel", "source_urls": [] }
Only use source_urls from the trend context. Return JSON only.
```

**P2 Pillar draft**
```
Brief: {{brief}}
Angle: {{angle}}
Write a long-form draft of 800 to 1,200 words that makes one clear point. Use only facts from the brief. Mark any claim that needs a source with [SOURCE NEEDED].
```

**P3 LinkedIn adapt**
```
Pillar: {{pillar}}
Write one LinkedIn post following the channel spec: hook within 200 characters, body 600 to 1,300 characters, 0 to 3 hashtags, at most one question at the end. Keep every fact from the pillar.
```

**P4 Instagram adapt (caption)**
```
Pillar: {{pillar}}
Write one Instagram caption: hook within 125 characters, total 150 to 600 characters, 3 to 5 hashtags at the end.
```

**P5 Facebook adapt**
```
Pillar: {{pillar}}
Write one Facebook post of 50 to 150 words, plain paragraphs, 0 to 2 hashtags, at most one question.
```

**P6 Carousel deck JSON**
```
Angle: {{angle}}
Pillar: {{pillar}}
Return JSON only, matching this schema: { "slides": [{ "type": "cover"|"point"|"stat"|"quote"|"cta", "title": string (max 60 chars), "body": string (max 3 lines), "icon": string (a Lucide icon name) }] }
Between 7 and 10 slides. First slide is "cover". Last slide is "cta".
```

**P7 Humanise**
```
Rewrite the text below to remove these patterns: not-X-but-Y contrasts, one-line closers that repeat the point, forced triads, em dashes, inflated words (pivotal, transformative, revolutionary), stock AI words (leverage, delve, game-changer, unlock), bold labels in short posts.
Keep every fact, number, name, and claim. Do not add new facts.
Return JSON only: { "rewrite": string, "changes": [string] }
Text: {{post}}
```

**P8 Trend query**
```
Topic: {{topic}}
Return one search query of 3 to 6 words that finds recent, credible news on this topic. Return the query only.
```

Security note: user text and search results are data, not instructions. Prompts put them inside clearly marked blocks, and the parser rejects any output that isn't the requested JSON.

## 8. Logging and secrets

- Logs never print key values. The gateway logs the model name, token count, and status only.
- `.env.local` stays out of git. Check with `git status` before your first commit.
- Search results are stored with their URLs, not full page text.

---

## 9. v0.2 changes

### New and changed folders
```
postline/
  config/
    features.json         # all switches, defaults from doc 01 section 4a
  content/
    assets/
      logo.png            # optional, user-supplied
      logo.svg            # optional, one or the other
    log.md                # now includes length, variant, and reach columns
    weeks/YYYY-Www/days/YYYY-MM-DD/
      variants/
        linkedin-v1.md
        linkedin-v2.md
        linkedin-v3.md    # 3 only if the variant switch is set to 3
  src/lib/
    perf/rank.ts          # performance loop. Reads log.md only
    assets/logo.ts        # logo validation and placement
    features/flags.ts     # reads features.json, exposes one function per switch
```

### `config/features.json`
```json
{
  "trend_mode": false,
  "humanise": true,
  "carousel_render": false,
  "icons": false,
  "theme": "clean-light",
  "styling": { "corner": "rounded", "card": "flat", "padding": "medium" },
  "logo": { "enabled": false, "corner": "top-right", "size": "small", "opacity": 1, "all_slides": false },
  "variants": 2,
  "length": "medium",
  "performance_loop": { "enabled": true, "min_posts": 20, "min_group": 3 },
  "linter_soft_warnings": true
}
```

Every module checks its flag at the start of the call. When the flag is off, the module returns immediately and never reaches the network, the browser, or the model.

### Post frontmatter additions
```yaml
variant_index: 1           # which variant this is
selected: true             # true for the body that was chosen
length: medium             # short | medium | long
humanised: true            # whether the humanise pass ran
rendered: false            # whether carousel rendering ran
```

### `log.md` columns
`date | post_id | platform | topic | format | length | variant | minutes | edit_rating | reach | followers`

Reach and followers are entered by hand each week. Everything else is written by the app.

### Logo validation (`src/lib/assets/logo.ts`)
- Accept PNG or SVG only. Reject anything else with a clear message.
- Reject files over 2 MB.
- PNG must be at least 400 px wide.
- Return placement as absolute pixel values for the chosen size and margin.

### Performance module (`src/lib/perf/rank.ts`)
- Pure function: takes parsed `log.md` rows and the config, returns ranked groups with reasons.
- No network, no file writes. Reset is a separate function that the UI calls.

### New API routes (local only)
| Route | Method | Purpose |
|---|---|---|
| `/api/variants` | POST | Generate 2 or 3 variants for one post |
| `/api/length` | POST | Regenerate one post body at a new length |
| `/api/logo` | GET, POST | Check logo status, or validate an uploaded file |
| `/api/features` | GET, PATCH | Read or update switches. PATCH validates against the schema |
| `/api/perf` | GET, DELETE | Read ranking, or reset performance columns |

## 10. v0.2 prompts

**P3 (updated) LinkedIn adapt** now includes a length range:
```
Pillar: {{pillar}}
Length tier: {{length}}. Body must be {{length_range}} characters.
Hook within 200 characters. 0 to 3 hashtags. At most one question at the end. Keep every fact from the pillar.
```

**P4 and P5** get the same length placeholder, with the ranges from doc 03 section 6.

**P9 Variants**
```
Selected post: {{selected_post}}
Write {{n}} variants (n is 2 or 3). Each variant changes only the hook or the angle of the opening. Every fact, number, and name must match the selected post.
Return JSON only: [{ "variant_index": number, "hook": string, "body": string }]
```

**P7 Humanise** runs only when the humanise flag is on. No prompt change.

## 11. Changes to the model config

Add one task: `variants` with the same primary and fallback pattern as the others. Variants are the most-called task, so set it to the model with the highest free-tier limit.
