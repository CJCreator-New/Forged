# Optional features have on and off switches in config/features.json, and off means no code runs

Status: accepted

Every optional feature has a switch in `config/features.json`, and a switched-off feature makes no model call, no search call, and launches no browser. The switches are read fresh on each call, so an edit takes effect without a restart. We chose a config file over a database table so the user can change a switch in an editor or the settings screen, and so that "off" truly means zero cost and zero code path.
