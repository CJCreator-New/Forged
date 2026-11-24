# Postline

Postline is a personal content studio. One user turns a topic or campaign brief into posts for LinkedIn, Instagram, and Facebook, with optional carousel decks. This glossary holds the words the app and its docs use, so every name means one thing.

## Content

**Post**:
One piece of content for one Channel on one Day, with a Hook and a body.
_Avoid_: Draft (a status, not a thing), item, update

**Channel**:
A destination the Post is written for: LinkedIn, Instagram, or Facebook.
_Avoid_: Platform

**Format**:
Whether a Post is `text` or `carousel`.
_Avoid_: Type, kind

**Hook**:
The opening lines of a Post, the part visible before "see more" or "more".
_Avoid_: Intro, headline

**Variant**:
An alternative Hook or angle for one Post. Every fact matches the selected Post. Variants are generated only when you ask for them. Only the selected Variant is exported. The rest are kept for reuse.
_Avoid_: Version (a Version is a saved earlier body)

**Angle**:
One content idea offered by the ideas step, with its hooks and a recommended Format. You pick one Angle, and it becomes the day's Brief.
_Avoid_: Idea, topic

**Topic**:
One of the subject areas listed in `content/topics.md`, which starts with seven and can be edited. Broader than an Angle.
_Avoid_: Category, theme

**Length**:
The body size of a Post: short, medium, or long. It changes the body, never the facts or the Hook limit.
_Avoid_: Size, word count

## Carousel

**Deck**:
The slide set attached to one Post whose Format is `carousel`. Only LinkedIn and Instagram Posts have Decks in v1.
_Avoid_: Carousel (a carousel is the Format, not the object), presentation

**Slide**:
One page inside a Deck.

**Theme**:
A named colour preset for a Deck: clean light, dark tech, or warm paper.
_Avoid_: Style (style means Styling below)

**Styling**:
Per-Deck settings for corner radius, card style, and padding.

**Logo**:
A user-supplied image placed on Slides. The app never creates one.

## Structure

**Day**:
One calendar date's set of Posts, one per Channel, for one Angle.

**Week**:
Seven Days built from one Brief.

**Brief**:
The campaign input for a Week: goal, audience, key points, call to action, and an optional link.

**Pillar**:
The long-form draft written from a Brief. Each Post in the Week is adapted from it.
_Avoid_: Master draft, source draft

**Stale**:
A Post whose Pillar has changed since it was adapted. Stale Posts are flagged, never overwritten. You regenerate them one at a time.

**Status**:
Where a Post is in its life: `draft`, `reviewed`, `rendered`, or `exported`. A Post moves forward one step at a time. Changing its body resets it to `draft`. The app never changes an exported file.

## Quality

**Linter**:
The rule checker run on every Post and Variant before export.

**Hard rule**:
A linter rule that blocks export until fixed. Examples: no emojis, no em dashes, no engagement bait.

**Soft rule**:
A linter rule that warns inline and does not block.

**Humanise pass**:
A rewrite that removes AI-sounding patterns without changing facts. Runs before the linter. The rewritten text becomes the body, and the raw text is kept beside it so you can compare or restore it.

**Review tick**:
A manual confirmation required before export for healthcare and HR Posts.

**Edit rating**:
A self-rating of how much a Post was changed before publishing: `as-is`, `light`, or `rewrite`. The app asks for it after export and never blocks export without it.

## Learning

**Log**:
The user's record of published Posts, kept in `content/log.md`. Each row has the Post, its edit rating, and weekly reach and follower numbers entered by hand.

**Performance loop**:
Ranks Angles by the past reach of Posts with the same Topic and Format. It stays unranked until 20 Posts are logged. A Post counts only once its reach number has been entered.

## Settings

**Voice profile**:
The user's writing-style file, `content/voice.md`. The app reads it fresh on every generation. A regenerated profile is saved beside it as `voice.new.md`, and an edited `voice.md` is never overwritten.

**Feature switch**:
An on or off setting for an optional feature, stored in `config/features.json`. A switched-off feature runs no code, makes no model call, and launches no browser.

**Trend mode**:
A Feature switch that adds recent search results to the Angle step. If the search fails or reaches the monthly cap of 900 queries, generation stops and shows the reason. It never quietly continues without trends.
