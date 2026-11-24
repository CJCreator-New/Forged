# Postline: Build plan v1

Status: proposed, waiting for approval.

This plan turns the approved docs (01 to 05), the glossary (CONTEXT.md), and ADRs 0001 to 0008 into parallel work for Haiku agents. The user interface is built with the `frontend-design` skill.

## 1. Principles

- **Haiku for every builder and reviewer.** Each agent gets one small job, a fixed set of files it owns, and the doc sections it needs.
- **Contracts first.** Shared schemas, file formats, and config shapes are written once, before any parallel work starts. Agents read them and never change them.
- **Disjoint folders.** Each agent writes only to its own folder. Agents do not run git. The lead commits after each wave, after tests pass.
- **Tests with every feature.** An agent's job is done only when its tests pass.
- **Switches respected.** Every optional module is checked against its switch before it runs. Tests spy on the calls.
- **Nothing overwrites user text.** Enforced in the store and tested (ADR 0007).

## 2. Contracts (lead, before wave 1)

The lead writes these once. Every builder reads them and does not edit them.

| Contract | File | Used by |
|---|---|---|
| Post, Day, Week frontmatter schema | `src/lib/schemas/post.ts` | store, linter, pipeline, export |
| Ideas JSON schema (P1) | `src/lib/schemas/ideas.ts` | ideas pipeline |
| Deck JSON schema (P6, doc 03 section 3) | `src/lib/schemas/deck.ts` | deck pipeline, renderer, export |
| Log row schema | `src/lib/schemas/log.ts` | performance, log writer |
| Config shapes: models, channels, styles | `src/lib/schemas/config.ts` | gateway, pipeline, UI |
| API contract for each route (doc 04 section 6 and 9) | `docs/api-contract.md` | pipeline routes, UI |
| Logger rule (model, tokens, status only) | `src/lib/gateway/log.ts` stub | gateway and every model call |

The lead also fixes the three open numbers before wave 1: micro and extended length ranges per channel, the Instagram caption limit, and the Brave pace of one request per second.

## 3. Work packages

Each package has an owner (one Haiku builder), inputs, outputs, and a done check.

### Wave 1: no dependencies on each other (run in parallel)

| ID | Package | Inputs | Outputs | Done when |
|---|---|---|---|---|
| W1-A | Store: post, day, week read and write, raw copy, stale flag, no overwrite | ADR 0001, 0006, 0007; doc 04 section 3 | `src/lib/store/*` | tests show no write outside `content/`, raw copy saved, stale flag set, existing edits never replaced |
| W1-B | Linter: all hard and soft rules, dash rule (em and en), emoji ranges, name check | doc 03 section 5; decisions log | `src/lib/linter/*` plus fixtures (3 good and 3 bad per rule) | every rule has tests, dash and emoji fixtures pass |
| W1-C | Gateway: OpenRouter client, key status check (no model call), model list fetch, fallback on 429, one retry on bad JSON, logger | ADR 0002 (amended), 0004; doc 04 section 4; doc 05 gateway tests | `src/lib/gateway/*` | fallback order tested, key never in logs (spy test), key check makes no model call |
| W1-D | Performance: pure ranking over log rows, reasons, reset | doc 03 section 12; ADR 0007 | `src/lib/perf/*` | 19 rows gives no ranking, groups under 3 excluded, same input gives same output, no network |
| W1-E | Logo: validation (PNG or SVG, 2 MB, 400 px) and placement maths | doc 03 section 9 | `src/lib/assets/*` | the logo tests in doc 05 pass |
| W1-F | Config files and style presets: `config/styles/*.json` (four presets), channel ranges, model defaults from the checked list | doc 03 sections 2 and 6; decisions log | `config/*`, `config/styles/*` | loads and validates against the config schema |
| W1-G | Renderer: three themes and styling tokens as HTML templates, Playwright render, PNG and PDF | ADR 0003; doc 03 sections 3 and 8 | `templates/*`, `src/lib/render/*` | a 7-slide deck renders in each theme (snapshot test) |

### Wave 2: needs wave 1 outputs (run in parallel)

| ID | Package | Needs | Outputs | Done when |
|---|---|---|---|---|
| W2-A | Daily pipeline: ideas (P1), pick, drafts (P3 to P5), length tiers, variants on demand (P9), humanise (P7) with raw copy, linter on every output | W1-A, B, C, F | `src/lib/pipeline/daily/*`, routes | one topic gives 5 angles and 3 linted posts, humanise on and off tested |
| W2-B | Enhance: aim-based rewrite, fact check, linter, previous text saved as a version | W1-A, B, C | `src/lib/pipeline/enhance/*` | every fact in the post appears in the rewrite (fact test), previous text kept |
| W2-C | Deck pipeline: P6 with retry on bad JSON, validation, render call | W1-C, W1-G | `src/lib/pipeline/deck/*` | a carousel angle produces a valid deck and renders |
| W2-D | Trend mode: Brave query (P8), result filter, source links, monthly cap of 900, one request per second | W1-C, W1-A | `src/lib/pipeline/trend/*` | switch off makes no call, switch on cites URLs, cap blocks the 901st query |
| W2-E | Export: post markdown, deck PDF and PNG, alt text, week ZIP with README | W1-A, W1-G | `src/lib/export/*` | the step 4 check in doc 05 passes on a folder copy |

### Wave 3: needs wave 2 outputs

| ID | Package | Needs | Outputs | Done when |
|---|---|---|---|---|
| W3-A | Week pipeline: brief, pillar (P2), seven-day adaptation, stale flags on pillar change, week view data | W2-A, W1-A | `src/lib/pipeline/week/*` | a brief produces 21 saved posts, pillar change marks them stale |

### User interface (parallel with waves 2 and 3, once the API contract is fixed)

The UI is built with the `frontend-design:frontend-design` skill. Each screen is one Haiku builder, given the skill and the API contract.

| ID | Screen | Stories | Done when |
|---|---|---|---|
| UI-1 | Shell, navigation, settings (switches toggle, key presence, call counters, model list) | E8, E9, S1.1 | every switch can be toggled and the file updates |
| UI-2 | Daily page: topic, trend toggle, angles, pick, posts with variants, length, style, enhance, humanise switch | E2, E3.1, E10, E11, E5 | a topic can be taken through to an exportable post by clicking |
| UI-3 | Deck editor: theme, colours, styling tokens, icons, logo slot | E4, E12, E13 | theme change re-renders without touching text |
| UI-4 | Week page: brief, pillar, seven-day view with status cards, regenerate one, stale badge, week ZIP | E3.2, E7, E6.3 | 7 days with 21 cards, status shown |
| UI-5 | Performance screen: log entry, threshold message, ranking with reasons, reset | E14 | 19 posts shows "1 more needed" |

### Wave 4: review and integration (Haiku reviewers, one per area)

- **Reviewer R1, tests:** runs `npm test`, `npm run lint`, `npx tsc --noEmit`, and reports failures with file and line.
- **Reviewer R2, safety:** checks no key value in any output or log, no write outside `content/`, `templates/`, `config/`, dev server on 127.0.0.1, API rejects non-local requests (ADR 0008).
- **Reviewer R3, stories:** checks each story's acceptance criteria in doc 02 against the running app.
- **Golden run (lead, with your keys):** one real topic and one real brief through the live models. Output must pass hard rules.

## 4. Milestones mapped to doc 05

| Milestone | Waves and packages | Acceptance |
|---|---|---|
| M1 foundation, daily | Contracts, W1-A, B, C, D, F; W2-A, B; UI-1, UI-2 | daily flow with styles, lengths, variants, enhance, humanise, linter |
| M2 carousel | W1-G, W2-C; UI-3 | deck renders PNG and PDF in two themes |
| M3 week, export, trends | W3-A, W2-D, W2-E; UI-4 | 21 posts, ZIP export, trend cap |
| M4 performance, settings, polish | W1-D, W1-E; UI-5; settings polish; reviewers R1 to R3 | performance tests, logo tests, full acceptance script |

## 5. Parallel schedule

```
Lead: contracts (sequential, first)
        |
Wave 1: W1-A  W1-B  W1-C  W1-D  W1-E  W1-F  W1-G   (7 agents at once)
        |
Wave 2: W2-A  W2-B  W2-C  W2-D  W2-E  + UI-1  UI-2 (7 agents at once)
        |
Wave 3: W3-A  + UI-3  UI-4  UI-5                    (4 agents at once)
        |
Wave 4: R1  R2  R3  then golden run (lead, your keys)
```

Waves do not wait on each other inside the same wave. A builder that finishes early starts the next package whose inputs are ready.

## 6. Agent brief template

Every builder receives:

1. **Goal:** one sentence.
2. **Owned folder:** the only folder it may write to.
3. **Inputs:** the exact doc sections and contract files.
4. **Outputs:** the files it must create.
5. **Done check:** the test command and expected result.
6. **Rules:** no git commands, no edits to contracts, no emojis or em dashes in any generated copy, no keys in output.
7. **Progress:** after each step, run `node ~/.dashboard/dash.mjs agent --agent "<this agent's description>" --steps <done>/<total>`.

## 7. Risks and how the plan handles them

| Risk | Handling |
|---|---|
| Haiku agents drift from contracts | Contracts are fixed first. Reviewers check each area against them. |
| Parallel agents collide in files | Disjoint folders. Only the lead commits. |
| UI quality on Haiku | Each UI builder uses the `frontend-design` skill and gets one screen. The lead reviews each screen before it merges. |
| Free model IDs change | The model list is fetched at runtime. The chosen default is re-checked before the golden run. |
| Brave charges after the credit | Monthly cap of 900, pacing at one request per second, tested. |
| Golden run needs your keys | Runs only when you provide them. Everything else is tested with mocks. |

## 8. Open items before wave 1

1. Micro and extended length ranges per channel. Lead proposes values for your approval.
2. Confirm the Instagram caption limit (2,200) and carousel size (1080 x 1350) from Instagram's own help page.
3. Confirm the OpenRouter key-status endpoint.
4. Update docs 01, 02, 03, and 04 to match the decisions (topics, Brave cap, dynamic models, styles, lengths, enhance, Facebook text only, `channel:` key). The lead does this as part of the contracts step.
5. Your approval of this plan.
