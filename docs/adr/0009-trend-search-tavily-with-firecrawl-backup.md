# Trend search uses Tavily first and Firecrawl as the backup, each with its own monthly cap

Status: accepted (replaces the Brave Search choice in PRD decision D5)

Brave Search now requires a card on file, so it is no longer used. Trend search tries Tavily first (1,000 free credits a month, no card, one credit per basic search). If Tavily is at its monthly cap or fails, it tries Firecrawl (1,000 free credits a month, no card, two credits per 10 results). Each provider has its own monthly cap in credits, kept in one file so it is easy to change. When both are out, trend mode stops with a plain message and never continues silently without trends. We chose two free providers over one because a single free allowance runs out mid-month, and the second one keeps trend mode usable without a card on file.
