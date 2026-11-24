# Markdown files are the only store, with no database

Status: accepted

All content (posts, ideas, weeks, logs, voice profile) is plain markdown with YAML frontmatter under `content/`. We chose this over Supabase or SQLite because there is one user on one machine and no sync requirement, so a database would add auth and migration work with nothing gained. The user can open and edit every file in any editor. Revisit only if the app is ever hosted or shared.
