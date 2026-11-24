# Postline: PRD v0.2 (working name)

Changes in v0.2: added trend mode, humanise pass, carousel rendering, icons, themes, logo slot and styling, post variants, post lengths, and the performance loop. Every optional feature has a default and an on/off switch (section 4a).

## 1. Problem

Posting every day on LinkedIn, Instagram, and Facebook takes too long. Generic AI drafts sound generic, ignore each platform's format, and need heavy editing. Carousels take the most time because slides get designed by hand.

## 2. Who it's for

One person: you. Runs on your Windows machine at localhost. No login, no hosting, no team features.

## 3. Goals (first 30 days)

| Goal | Target | How it's measured |
|---|---|---|
| Posts shipped from the tool | 3 per week in week 1, daily by week 4 | Manual log in `content/log.md` |
| Post quality | At least 60% published with light edits only | Self-rating on a 3-point scale at publish time |
| Time per post | Below what writing from scratch takes, by week 2 | Minutes logged per post |
| Reach and followers | Baseline in week 1, trend by week 4 | Weekly manual numbers. The tool does not optimise for these in v1 |

If week 2 ends with time per post still above writing from scratch, stop adding features and fix the voice file and channel prompts.

## 4. Scope v1

**In**
- Daily mode: a topic or rough thought goes in. Out come 5 to 10 angles, each with 3 hook variants, a recommended format (text or carousel), and a short "why this could travel" note. No virality promise.
- Trend suggestions: optional. Uses the Brave Search API (free tier) to pull recent items for a topic, then turns them into angles.
- Week mode: one campaign brief becomes 7 days of posts, built from one long-form pillar draft that is adapted to each channel.
- Channels: LinkedIn, Instagram, Facebook.
- Carousels: rendered to PNG on your machine. Themes, colours, and icons are editable in the UI.
- Voice: a `voice.md` profile built from writing samples you paste in.
- Quality checks: a rule-based linter plus an AI-tell pass (see doc 03).
- Export: single posts as markdown, one slide deck as a PDF plus a PNG set, and a week as a ZIP.
- Topics: AI, product development, latest new releases, HR, healthcare technology, operations management, people management.
- Post variants: 2 or 3 versions per post, differing only in hook or angle. You pick one.
- Post lengths: short, medium, and long for each channel. Length changes the body, not the facts.
- Carousel rendering: PNG per slide and PDF for LinkedIn documents. Opt-in per post.
- Themes: 3 built-in themes with colour, corner-radius, and card-style overrides.
- Icons: a searchable bundled set, one per slide. Opt-in.
- Logo slot and styling: your own logo file, with corner position, size, and opacity. Off by default.
- Humanise pass: on by default. Switchable off per session or per post.
- Trend mode: Brave search for fresh angles. Off by default.
- Performance loop: records edit ratings and reach. Ranks angles only after 20 logged posts. Before that, the order is neutral.

**4a. Feature switches (defaults)**

| Feature | Default | Switch |
|---|---|---|
| Trend mode | Off | Per session |
| Humanise pass | On | Per session and per post |
| Carousel rendering | Off | Per post |
| Icons | Off | Per slide |
| Themes | Clean light | Per deck |
| Logo | Off | Per deck, with placement on cover and CTA slides by default |
| Variants | 2 per post | Per post, 2 or 3 |
| Lengths | Medium | Per post |
| Performance loop | Off until 20 posts | Automatic after threshold, can be turned off |

Every switch is stored in `config/features.json`. A switched-off feature runs no code, makes no model call, and launches no browser.

**Out (v2 or later)**
- X, newsletters, blogs.
- Auto-publishing and scheduling.
- Analytics and performance tracking.
- Multi-user, hosting, sync.
- AI-generated photos. Slides are typographic and icon-based only.

## 5. Decisions log

| # | Decision | Why |
|---|---|---|
| D1 | Next.js + TypeScript + Tailwind, local only | Matches your stack, runs on Windows with Node. No Docker needed |
| D2 | Markdown files as the store, no database | You own every file and can open it in any editor. Supabase isn't needed without sync |
| D3 | OpenRouter by default, direct Anthropic or OpenAI keys optional | You asked for free tier first, with other keys available |
| D4 | Slides rendered from HTML/CSS to PNG with headless Chromium | Pixel-accurate carousels with themes and icons |
| D5 | Brave Search free tier for trends | You approved it |
| D6 | Healthcare topics are about health technology, not practice | Claims filter targets efficacy and treatment claims, not every health word |
| D7 | Channels are LinkedIn, Instagram, Facebook only | Your answer in batch 2. I had listed X earlier. It's dropped from v1 and can be added later as one adapter |
| D8 | Keys live in `.env.local`, never in code, never in logs | Keys are the most expensive thing to leak |
| D9 | Every optional feature has a switch in `config/features.json` | You can turn things off without touching code, and off means zero cost |
| D10 | Performance loop waits for 20 logged posts before ranking | Below that, rankings are noise |
| D11 | Logo is user-supplied only. The app never generates or edits a logo | Avoids brand and trademark problems |
| D12 | Each post has short, medium, and long lengths, plus 2 or 3 variants | One brief serves several contexts, and you test hooks without a second tool |

## 6. Success criteria for v1

- Generates a full day (3 posts plus slides) from a topic in under 3 minutes of model time.
- Generates a full week from a brief with no manual copy-paste between steps.
- Slides export as PNG and PDF with the chosen theme, colours, and icons.
- All text passes the linter's hard rules before it can be exported.
- Everything you create is a readable file on disk.
- Every optional feature can be switched off, and the app still works with all switches off.
- The logo appears only when one is set. Without a logo, slides look complete.
- Variants keep the same facts as the selected post. The linter checks each variant.
- The performance loop shows no ranking before 20 logged posts, and says why.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Posts sound generic | Voice file from your samples, AI-tell pass, weekly edit-rate tracking |
| Platforms penalise engagement bait ("comment YES to get...") | Linter flags it as a hard warning |
| Free model limits or quality shifts | Model is a config setting with a fallback list. Test the chosen model each week |
| API keys leak | `.env.local` in `.gitignore`. Keys read server-side only. Logs redact them |
| Healthcare posts drift into medical claims | Linter flags efficacy and treatment claims. Manual review checkbox before export |
| HR posts name real people or employers | Linter flags capitalised names in HR topics for review |
| You stop using it after week 2 | The 30-day goals above are the check. Review them on day 14 |
| Chromium download is large | Install once, reuse. Expect a few hundred MB |
| Variants triple model calls per post, which can exhaust free-tier limits | Variants are 2 by default. Each variant is a separate call with a visible count in the UI |
| Performance loop learns from too little data and gives misleading rankings | 20-post threshold and 3-post minimum per topic and format |
| Logo used without rights | The app stores only the file you provide. Using a logo you have rights to is your responsibility |
| Feature sprawl delays v1 | Every optional feature is off by default and sits in its own milestone |

## 8. Open items

None block the build. Defaults in this pack apply unless you change them.
