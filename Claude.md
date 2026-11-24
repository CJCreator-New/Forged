# Postline

Personal AI content studio. Local only. Single user. Next.js + TypeScript + Tailwind.

## Read first
- docs/01-PRD.md for scope and decisions
- docs/02-user-stories.md for acceptance criteria
- docs/03-voice-channel-slide-spec.md for rules and limits
- docs/04-architecture-and-prompts.md for structure and prompts
- docs/05-test-plan-and-task-graph.md for tests and milestones

## Non-negotiables
- Model keys are read on the server only, from process.env. Never import the gateway in client code. Never log key values.
- Generated post text must contain no emojis and no em dashes. The linter enforces this. Do not add exceptions.
- A feature switched off in config/features.json makes no model call, no search call, and launches no browser.
- Files under content/ are the user's data. Never delete or overwrite them without asking.
- Writes stay inside content/, templates/, and config/. Nothing else.
- Dev server binds to 127.0.0.1 only.
- Do not add a dependency unless it is named in the docs or I approve it first.
- Do not guess free model IDs. Check the current list and report what you picked.

## Working style
- For any task with more than three steps, plan first and wait for my approval.
- Write tests before or with each feature. A task is done only when its tests pass.
- Run npm test, npm run lint, and npx tsc --noEmit before saying a task is done.
- Keep changes small. Commit after each passing task with a clear message.
- If a doc is ambiguous, state one assumption, proceed, and note it in docs/decisions.md.

## Windows notes
- Use PowerShell commands unless a script needs bash. Use forward slashes in code paths.
- Playwright install: npx playwright install chromium