# Roadmap

Time is a history timeline maker for fictional worlds, at time.eurth.org: tracks for nations, dynasties and the shared world, with reigns, wars and single events laid out on an axis that zooms from millennia down to days, all dated in the world's own calendar. It is one of Eurth's free worldbuilding tools.

Three parts: what comes next, what each release added (newest first), and what's not planned.

## Where to pick up

**Now: step 4, the core. 4a is done; carry on at 4b.** Stijn agreed to the plan on 14 November 2026. Each finished part is ticked below.

Run `npm install`, then `npm run check` and `npm test`: both must pass before and after every part.

Check these two before each working session, because they decide what may be built:

| Gate | How to check | State on 14 November 2026 |
| --- | --- | --- |
| `@eurth/calendar` 1.0.0 | `gh release list -R eurth-org/eurth-calendar` | Not released. The engine exists only in the Calendar session's working folder. Until the release, dates stay behind `src/time/dates.ts` (step 4a). |
| `@eurth/style` 1.0.0 | `gh release list -R eurth-org/eurth-style` | Not released, and `HANDBOOK.md` isn't written yet. Until the release: no site, no pages, no styles. The rules used for this plan are the handbook section of eurth-style's own brief. |

## Next

### Step 4: the core, as plain TypeScript with tests (no site)

Everything lives in `src/time/` and `src/content/`, tested with Vitest in `tests/`. No Astro, Svelte or `@eurth/style` in this step. Commit and push after each letter, and tick it off here.

- [x] **4a. Skeleton and dates.** `package.json` (TypeScript and Vitest only, Node 22), `tsconfig.json`, `vitest.config.ts`, `LICENSE` (Apache 2.0), `docs/feedback-log.md`, CI that checks and tests.
  - `dates.ts`: the small interface the rest of the tool sees, `DateEngine`: day number of a date and back, the start and length of a year, the parts of a year (months and days outside the months), year labels ("1022 FS", "3 Before the Founding"). A day number is a whole number, 0 for day 1 of year 1, the same count `@eurth/calendar` uses, so its `Calendar` drops in behind the interface without touching anything else.
  - `engine.ts` holds the interface and `engineFor(calendar)`, the one place that changes when the package arrives. `plain.ts` is a stand-in engine of Time's own that reads the same calendar definition (months, days outside the months, leap rules), so invented calendars work today; without a calendar it is Gregorian.
  - Deep time: beyond the engine's range (the calendar engine stops at ten million years either way) a date is a year only, placed by the mean length of the year. That is what lets someone date an event before the Big Bang.
  - `fuzzy.ts`: dates as a person writes them. Exact to the day, the month or the year; "c. 1650"; "1650s"; "17th century". Each becomes a first day, a last day and a way to write it back. Parsing and formatting both ways, tested against all three example calendars.
- [ ] **4b. The model.** `model.ts`: a timeline is a title, a calendar (or none, meaning Gregorian), eras, and tracks; a track has spans (label, from, to or "ongoing", text, links, a tone) and events (title, date, text, links). `normalize.ts` cleans anything that arrives from a link or a file: caps on counts and lengths, https links only, dates that don't exist put right or dropped, with a list of what was changed. Never throws. Add, edit, move and remove as pure functions that give back a new timeline, so undo is a list of timelines.
- [ ] **4c. The axis and the layout.** `axis.ts`: a view is a first day, a last day and a width. Tick levels from a thousand million years down to days; which levels show at a zoom, and how visible each label is (0 to 1, by the space between ticks). That number is the signature touch: labels fade in and out as you zoom, like place names on a map. Zoom about a point, pan, fit to the content, clamp. `layout.ts`: spans that overlap in a track go on rows of their own; event labels that would collide give way by date order, the marker always stays; eras across the top. Pure numbers out, no DOM.
- [ ] **4d. Words and keys.** `describe.ts`: the whole timeline as text: a summary line, the eras, then each track with its spans and events in date order. One source for the screen-reader version, the search-engine version and "Copy description". `nav.ts`: the order the keyboard walks: next and previous in time, up and down a track, first and last, and which card is open.
- [ ] **4e. Saving.** `link.ts`: the timeline packed into `?t=1.<base64url>` (short keys, lists, nothing at its default), with the calendar beside it as `?cal=`, the same text cal.eurth.org's "Use in a timeline" link carries. A timeline too long for a link (over 8,000 characters) says so and points to the profile file. `profile.ts`: the `timeline` section of the profile: the schema's own fields as a digest any tool can quote (`title`, `startYear`, `endYear`, up to 200 `events`), and the whole timeline under `definition`, the way Calendar keeps its whole calendar. Reads `calendar` (through `@eurth/calendar`'s own reader once released) and `dynasty`.
- [ ] **4f. Exports.** `svg.ts`: the visible range as a standalone SVG (colours handed in, so the site passes the style tokens; every span carries its label; the description inside as `<title>` and `<desc>`). PNG is that SVG drawn to a canvas in the site. `wikitext.ts`: a sortable wikitable for a history section. `csv.ts`: one row per era, span and event. `embed.ts`: the iframe snippet for eurth.org.
- [ ] **4g. Content.** `src/content/guide.ts`: how to build a believable history: causes and consequences, parallel tracks, how long things really take (reigns, wars, dynasties, building a cathedral, crossing an ocean), with sources and a last-updated date. `glossary.ts`: some 30 terms (era, epoch, regnal year, interregnum, circa, floruit, terminus post quem, anachronism and so on). `examples.ts`: three timelines in three calendars: Gregorian, one of Calendar's invented presets with an Earth link, and one with days outside the months and no link to Earth. Tests render and export all three.
- [ ] **4h. Plug in the engine.** When `@eurth/calendar` 1.0.0 is released: install it from GitHub (`github:eurth-org/eurth-calendar#semver:^1`), put its `Calendar` behind `DateEngine`, read calendars from `?cal=` and from the profile, and run the whole test suite against its presets. Then delete `plain.ts` and make `src/content/calendars.ts` re-export the package's presets.

### Step 5: the site (only after `@eurth/style` 1.0.0)

Start from the starter template in eurth-style and read `HANDBOOK.md` first; it wins over this plan.

- **Pages:** Timeline (the tool), Guide, Glossary, Examples, and a bare `/embed/` page for the iframe.
- **The timeline:** eras across the top, tracks with their names down the left, the year axis below, as on the mock-up. Drag to pan, wheel or pinch to zoom, plus and minus buttons. Uncertain dates are drawn as such (a dashed end, "c." in the label) and said as such.
- **The card:** select an event or span to see its title, date, text and links (forum thread, wiki page). Edit in the same place.
- **Keyboard:** arrow keys between events and tracks, plus and minus to zoom, Enter to open the card, Escape to close it. Targets 44 by 44 pixels.
- **The text version** of the whole timeline on the page, from `describe.ts`: for screen readers and for search engines.
- **Calendar:** from a profile, from a `?cal=` link, or Gregorian. A line under the title says which ("dates from cal.eurth.org").
- **Saving:** Copy link for short timelines; Load profile and Save profile for any.
- **Exports:** PNG and SVG of the visible range, wikitext, CSV, the embed snippet, Copy description, and the handbook's share dialog.
- **Delight:** the fading axis labels; "Ambitious." for an event dated before the Big Bang.
- **The handbook's checklist:** contrast, axe, Lighthouse, headers, offline, install, launch workflow for door 8 (17 December 2026, 00:00 Europe/Brussels), README, and Time's entry in `tools.json` (already there).
- **Done when** the checklist passes and timelines in three different calendars render and export correctly.

### Questions for Stijn

None of these block step 4; each has a default that I'll follow unless told otherwise.

1. **Dynasty reigns.** The brief says reigns can become spans, but the profile's `dynasty` section holds only the house, the law, the monarch, the heir and the line of succession: no dates. Default: Time reads a `reigns` list from the section if Dynasty writes one (name, from, to, as years or calendar dates), and offers nothing when it isn't there. A note for the Dynasty session is in the shared notes folder.
2. **The whole timeline in the profile.** The profile's roadmap rules out "a tool's whole design in the profile", yet this brief wants any timeline saved there, since a long one can't fit a link. Default: do as Calendar does and keep the whole thing under `timeline.definition`, with the schema's small fields as a digest. The schema already keeps unknown keys, so nothing in eurth-profile has to change.
3. **"Collaborators can add their nation as a track"** is on the mock-up but not in the brief. With no accounts, that can only mean: load a second link or profile and add its tracks to yours. Default: after v1 (it's under "Later").
4. **Page name.** The mock-up's menu says "Maker"; the brief says "Timeline". Default: Timeline.

### Later

- **Add tracks from someone else's timeline:** load a second link or profile and take its tracks, which is how a shared world's history gets built without accounts.
- **A second calendar on the same axis,** so two nations can each read the timeline in their own reckoning.
- **Group and collapse tracks** (a continent, an alliance).
- **Print:** a timeline across several pages, as a PDF made in the browser.
- **Pictures on cards** (a link to an image, shown in an `<img>`).
- **Import from CSV,** the same columns the export writes.
- **A link preview picture per timeline** (a Worker would draw it).

## 14 November 2026: groundwork (no release yet)

- The brief saved as `CLAUDE.md`; the public repository eurth-org/eurth-time created.
- Read the sibling projects as they stood that evening: eurth-style (its brief, tokens, `tools.json` and starter template; no `HANDBOOK.md` and no release yet), eurth-profile (schema 1, with its `timeline`, `calendar` and `dynasty` sections), eurth-calendar (the engine's types and API, still unreleased), eurth-flag (the reference build) and the mock-up board.
- This plan.

## Not planned

- **Accounts, a server or live editing together.** A timeline lives in its link or in the profile file. Sharing it means sharing one of those.
- **Browser storage.** No local storage, cookies or IndexedDB. "Save" is a link or a download.
- **Times of day.** The smallest step is a day. A battle that turns at noon says so in its text.
- **Real-world history as ready-made data.** The examples are invented. Plenty of sites chart Earth's history; this one is for worlds that don't exist.
- **AI-written histories.** The guide teaches how to write one; the tool doesn't write it for you.
- **Converting between two invented calendars that share no link to Earth.** There is nothing to convert through.
- **Trackers and analytics.**
