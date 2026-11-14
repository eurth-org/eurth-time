You're building Time (time.eurth.org), history timelines for fictional worlds, dated in the world's own calendar. One of Eurth's free worldbuilding tools; Eurth (eurth.org) is a worldbuilding and roleplay community since 2004. The attached repo is eurth-org/eurth-time.

Working order (Foundations and many other tools are being built at the same time tonight):
1. Save this brief as CLAUDE.md.
2. If the repo named above doesn't exist on GitHub yet, create it as a public, empty repo in eurth-org with the gh CLI and connect this folder; if you can't, ask me.
3. Read what already exists of github.com/eurth-org/eurth-style (HANDBOOK.md), github.com/eurth-org/eurth-profile and github.com/eurth-org/eurth-calendar; they may still be in progress. Write the plan and show it to me.
4. Build the tool's core logic as plain TypeScript modules with thorough tests, and its content and data (guide text, presets, examples). None of that needs eurth-style. Until @eurth/calendar 1.0.0 is released, keep dates as plain day numbers behind a small interface, so the engine plugs in later.
5. Only once @eurth/style 1.0.0 is released (check the releases of github.com/eurth-org/eurth-style), start the site from its starter template and carry on to the end of this brief. Until then, don't scaffold the site, pages or styles.
6. Commit and push after every finished step, and keep roadmap.md up to date with exactly where to pick up, so a new session can continue if this one stops.

Background for every step: Read HANDBOOK.md in github.com/eurth-org/eurth-style and start from its starter template; read the profile schema in github.com/eurth-org/eurth-profile; use @eurth/calendar from github.com/eurth-org/eurth-calendar for every date; look at github.com/eurth-org/eurth-flag, the reference build. The handbook wins over this brief on everything shared. Then write a plan and show it to me before you build.

Mock-up: the "time.eurth.org, history timelines" board on https://claude.ai/artifact/32RKDdVTtCfHsL6Qc6LxV6.

Pages: Timeline, Guide, Glossary, Examples.

The timeline, v1
- Tracks (a nation, a dynasty, the shared world), each with spans (reigns, wars, eras of a state) and events (a single date).
- Eras across the top; a year axis that rescales as you zoom, from millennia down to days.
- Dates in the world's calendar: load a calendar from a profile or from cal.eurth.org's "Use in a timeline" link; without one, the Gregorian calendar. Uncertain dates ("c. 1650", "1650s") are allowed and shown as such.
- Select an event or span to see its card: title, date, a short text, and links (forum thread, wiki page).
- Keyboard: move between events, zoom, open the card. A text version of the whole timeline for screen readers, also used for SEO.
- Spans and events never rely on colour alone: every span carries its label.

Saving: short timelines in the link; any timeline in the profile file.

Profile section "timeline": tracks, spans, events and eras. It reads "calendar" and, if present, "dynasty" (reigns can become spans).

Exports: PNG and SVG of the visible range, a wikitext timeline table for a history section, an embed for eurth.org (iframe; the handbook's frame-ancestors allows it), CSV, Copy description.

Guide: how to build a believable history: causes and consequences, parallel tracks, how long things really take, with sources.

Signature touch: zooming smooths the axis labels in and out, like a map. Easter egg: an event dated before the Big Bang gets "Ambitious."

Done when the handbook's checklist passes and timelines in three different calendars render and export correctly.
