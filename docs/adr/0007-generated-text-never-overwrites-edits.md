# Generated text never overwrites text the user has edited or kept

Status: accepted

Regeneration, the Pillar change, and the humanise pass all produce new text, and none of them replaces what the user has written without an explicit action. A changed Pillar marks adapted Posts as stale, and the raw text from the humanise pass is saved beside the body, and a regenerated voice profile is saved as `voice.new.md` beside an edited `voice.md`. We chose this over automatic rebuilds because a rebuild can silently erase a week of hand edits, and the cost of keeping both copies is a few extra files.
