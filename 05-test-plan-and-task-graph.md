# Postline: Test plan and task graph v0.2

## Part A. Test plan

### A1. Automated tests

| Layer | What it tests | Tool | Pass condition |
|---|---|---|---|
| Linter (unit) | Each H and S rule on known good and bad strings | Vitest | 100% of fixtures match expected results |
| Schemas (unit) | Ideas JSON, deck JSON, frontmatter | Vitest + zod | Invalid samples are rejected with clear errors |
| Store (unit) | Read and write of content files, path safety | Vitest | No write outside `content/`. Path traversal blocked |
| Gateway (unit) | Fallback on 429, retry on bad JSON | Vitest with mocked HTTP | Correct fallback order. Key never appears in logs |
| Renderer (snapshot) | Each theme and slide type at 1080 x 1350 | Playwright screenshot diff | No pixel diff beyond a 0.5% threshold |
| Golden pipeline | Fixed topic and fixed brief through real models | Script, weekly | Output passes all hard rules. Facts from the brief all appear |
| API security | Non-local requests are rejected. Keys never in responses | Supertest | Requests from other IPs get 403 |

Golden tests check constraints, not exact wording. Model output changes, so exact-match tests would break on every model change.

### A2. Manual evaluation (the real test)

Rate each generated post 1 to 5 on:
1. Sounds like me
2. Right format for the channel
3. Hook works on its own
4. Facts are correct and sourced
5. I'd post it with light edits or less

Pass: average of 3.5 or higher across 10 posts, and no score of 1 on criterion 4.

### A3. Week-1 acceptance script

1. Set up keys and voice file. Time it.
2. Run one daily flow end to end on a real topic. Export the three posts and one deck.
3. Run one week flow from a real brief. Export the ZIP.
4. Open the ZIP on another machine or folder. Confirm everything reads without the app.
5. Turn each theme on and change one colour. Confirm the deck re-renders.
6. Try to export a post that contains an emoji. Confirm it is blocked.

## Part B. Milestones

| Milestone | Scope | Done when |
|---|---|---|
| M0 | Docs approved | You sign off on docs 01 to 05 |
| M1 | Foundation and one daily post | `npm run dev` runs. Topic in, 3 channel drafts saved to `content/`. Linter runs |
| M2 | Carousel | Deck JSON generated, rendered to PNG and PDF with two themes |
| M3 | Week flow and export | Brief in, 21 posts saved, ZIP export works |
| M4 | Trends, themes, icons, polish | Trend mode on or off. Theme and colour pickers. Icon picker. Week view |

Each milestone ends with a 30-minute review of the week-1 acceptance steps that apply to it.

## Part C. Task graph

### C1. Dependency view

```
Phase 0: docs approved (you)
        |
Group 1 (parallel, no dependencies on each other):
  T1 Scaffold, store, config, .env loading
  T2 Model gateway (OpenRouter + optional adapters, fallback, retry)
  T3 Linter (pure functions, fixtures)
  T4 Slide renderer (templates, Playwright, PNG, PDF)
        |
Group 2 (parallel, each needs its Group 1 input):
  T5 Ideas and daily drafting pipeline   (needs T1, T2, T3)
  T6 Deck generation and validation       (needs T2, T4)
  T7 Brave trend mode                     (needs T1, T2)
        |
Group 3 (parallel, needs Group 2 output):
  T8 Week planner pipeline                (needs T5)
  T9 UI shell: pages, forms, week view    (needs T1 and the API contract in doc 04)
  T10 Export (post, deck, ZIP)            (needs T1, T4)
        |
Group 4:
  T11 Reviewer: tests, golden run, security check, merge
  T12 Week-1 acceptance run (you)
```

Groups 1 and 2 are where most of the speed comes from. T1 defines the file layout and schemas that everyone else reads, so it lands first in the group.

### C2. Per-agent briefs

Each builder agent gets only the doc sections listed here. Keeping context small reduces mistakes.

**Planner (orchestrator).** Inputs: docs 01 to 05. Job: split work into the tasks above, keep the dependency order, assign builders, collect outputs. Done when every task has an owner and a done check. Does not write code.

**Builder: T1 (foundation).** Inputs: doc 04 sections 1 to 3, doc 02 E1 and E8. Output: Next.js app, store module, config loader, `.env.local` loading, `.gitignore`. Done when the app starts, reads a sample post file, and rejects a path outside `content/`.

**Builder: T2 (gateway).** Inputs: doc 04 section 4, doc 02 S1.1 and S1.2. Output: adapters for OpenRouter, Anthropic, OpenAI; fallback and retry; zod validation for JSON. Done when the unit tests in A1 pass.

**Builder: T3 (linter).** Inputs: doc 03 section 5. Output: rule functions and a fixtures file with at least 3 good and 3 bad examples per rule. Done when every rule has tests.

**Builder: T4 (renderer).** Inputs: doc 03 section 3, doc 02 S4.2 to S4.4. Output: three templates, the deck JSON validator, Playwright render, PDF export. Done when a 7-slide deck renders in each theme and passes snapshot tests.

**Builder: T5 (daily pipeline).** Inputs: doc 04 sections 5 and 7 (P1 to P5, P7), doc 02 E2 and E3.1. Output: the ideas route, the pick route, and three parallel drafts. Done when a real topic produces 5 angles and 3 linted posts.

**Builder: T6 (deck pipeline).** Inputs: P6, doc 03 section 3. Output: deck generation with retry on invalid JSON. Done when a carousel angle produces a valid deck and renders.

**Builder: T7 (trends).** Inputs: P8, doc 02 S2.2. Output: Brave query, result filtering, source links carried into the ideas prompt. Done when trend mode on produces linked angles and trend mode off makes no search call.

**Builder: T8 (week planner).** Inputs: doc 04 section 5 week flow, doc 02 E3.2 and E7. Output: pillar generation, 7-day fan-out, week view data. Done when a brief produces 21 saved posts.

**Builder: T9 (UI).** Inputs: doc 02 E2, E4, E5, E7, doc 04 section 6. Output: pages for ideas, drafts, deck editor (theme, colours, icons), week view, settings. Done when each story's acceptance criteria can be clicked through.

**Builder: T10 (export).** Inputs: doc 02 E6. Output: post, deck, and ZIP export with README. Done when the A3 step 4 check passes.

**Reviewer (T11).** Inputs: docs 01 to 05, all test output. Job: run the test suite, run the golden pipeline, check that no key value appears in any output or log, check that no file is written outside `content/`, check each story's acceptance criteria. Output: a pass or fail list with file and line for each failure. Does not fix code. Sends failures back to the owning builder.

### C3. Merge and review rules

- Each builder works on its own folder. Shared files (schemas, config) change only through T1.
- A change to a shared schema needs a note to every builder that reads it.
- Nothing merges until the reviewer's list has no open hard failures.
- Each merge runs the unit tests from A1. Snapshot tests run on merge to main only.

### C4. Automation candidates (after M3)

- A script that re-renders a whole week's decks after a theme change.
- A weekly command that runs the golden pipeline and writes its results to `content/log.md`.
- A reminder at 09:00 that prompts you to run the daily flow. Only if you find yourself skipping it.

## Part D. Before you approve

Confirm or change these before M1 starts:
1. Working name "Postline" is fine for now.
2. The default channel sizes in doc 03 section 2 are acceptable.
3. The free models are chosen at build time (T2), not now.

---

## v0.2 changes

### Part A additions: test cases for v0.2

| Area | Test | Pass condition |
|---|---|---|
| Feature switches | Spy on each module with its switch off | Zero calls to search, Chromium, or the model for that feature |
| Feature switches | All switches off, run a full daily flow | Completes with drafts, linted, and no optional module touched |
| Variants | Generate with the variant switch at 2 and at 3 | Count matches the switch. Each variant passes its own lint |
| Variants | Fact check | Every number and name in the selected post appears in each variant |
| Lengths | Each channel at short, medium, long | Body length falls inside the range in doc 03 section 6 |
| Carousel rendering | Carousel rendering off | No Chromium launch. Turning it on renders the deck |
| Themes and styling | Snapshot the cover slide for each theme, corner setting, and card style | No pixel diff beyond 0.5% |
| Icons | Icons on with a slide that has no icon | Slide renders with no empty placeholder |
| Logo | Upload a JPG, a 3 MB PNG, a 300 px PNG | All three rejected with a specific message |
| Logo | Valid logo, each corner and size | Logo sits 60 px inside the edge, at the correct size |
| Logo | No file present | Logo slot hidden. No error in the log |
| Humanise | Switch off | No humanise call. Linter still runs |
| Humanise | Switch on | Both raw and humanised versions saved |
| Trend mode | Switch off | No Brave call. Switch on: each angle with a trend cites a URL |
| Performance loop | 19 logged posts | No ranking. Screen shows "1 more post needed" |
| Performance loop | 20 posts, groups under 3 excluded | Ranking uses only groups with 3 or more posts |
| Performance loop | Same log, run twice | Identical output. No network call (spy test) |
| Performance loop | Reset | Performance columns cleared. Posts unchanged |

### Part A2. Week-1 acceptance script additions
Add to A3:
7. Turn each switch on once and off once. Confirm that the app works in both states and that a switched-off feature makes no call.
8. Upload a logo, render one carousel, then remove the logo and render again. Confirm the second render has no logo and no errors.

### Part B. Milestones (revised for v0.2)

| Milestone | Scope |
|---|---|
| M0 | Docs approved (v0.2) |
| M1 | Foundation, feature switches, daily drafts, humanise pass, linter, variants (2 or 3), lengths (short, medium, long) |
| M2 | Carousel rendering, themes, styling tokens, icons, logo slot and styling |
| M3 | Week flow, export (post, deck, ZIP), trend mode |
| M4 | Performance loop, week view, settings screen, polish |

Each milestone ends with the week-1 acceptance steps that apply to it.

### Part C5. Task graph additions for v0.2

New tasks:

| Task | Needs | Group |
|---|---|---|
| T12 Feature switches (`features.json`, flag module, settings API) | Nothing | Group 1 (add to T1) |
| T13 Variants and lengths (P9, length ranges, variant files) | T2, T5 | Group 2 |
| T14 Logo validation and placement | T1 | Group 1 (runs in parallel with T4) |
| T15 Styling tokens and icon picker in the renderer | T4 | Group 2 |
| T16 Performance module (pure function, reset, UI state) | T1 (for log schema) | Group 1 (runs in parallel; no model calls) |
| T17 Trend mode toggle and search-call counter | T7 | Group 3 |

**Why T16 can run early:** the ranking is a pure function over `log.md`, so it has no model or browser dependency. A builder can write and test it while the drafting pipeline is still in progress.

### C2 additions: per-agent briefs

**Builder: T13 (variants and lengths).** Inputs: doc 03 section 6, doc 04 section 10 (P9), doc 02 E10 and E11. Output: variant and length generation, variant files, length regeneration keeping hook options. Done when a post generates 2 or 3 variants, each passing lint, and changing length stays inside the range.

**Builder: T14 (logo).** Inputs: doc 03 section 9, doc 02 E13, doc 04 section 9 (logo validation). Output: validation, placement maths, the hidden-slot behaviour. Done when the logo tests in Part A pass.

**Builder: T15 (styling and icons).** Inputs: doc 03 section 8, doc 02 E12. Output: corner, card, and padding tokens, and the icon picker. Done when the theme snapshot tests pass.

**Builder: T16 (performance loop).** Inputs: doc 03 section 12, doc 02 E14, doc 04 section 9 (performance module). Output: ranking function, reason strings, threshold screen, reset. Done when the performance tests in Part A pass, including the no-network spy test.

**Builder: T17 (trend toggle).** Inputs: doc 03 section 11, doc 02 S2.2. Output: switch wiring, search-call counter in settings. Done when the trend tests pass.

### C3 addition
The reviewer checks the feature-switch tests first. A switch that isn't fully off is a bug, because it costs quota or leaks data even when the user doesn't want the feature.
