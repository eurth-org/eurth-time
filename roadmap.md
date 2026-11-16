# Roadmap

Time is a history timeline maker for fictional worlds, at time.eurth.org: tracks for nations, dynasties and the shared world, with reigns, wars and single events laid out on an axis that zooms from millennia down to days, all dated in the world's own calendar. It is one of Eurth's free worldbuilding tools.

Three parts: what comes next, what each release added (newest first), and what's not planned.

## Where to pick up

**The tool is built, at 0.2.0, and CI is green on `main`: types, build, tests, axe, the smoke test in a real browser, and Lighthouse. It waits for its door: 17 December 2026, 00:00 in Brussels.** What is left is under "Before the door" (none of it is building) and under "Later, and what each waits for" (two things that can't be built here yet).

Before any change: `npm install`, then `npm run check`, `npm run build`, `npm test` and `npm run axe`. All four must pass before and after. Astro wants a newer Node than 22.14: put Homebrew's `node@26` first on `PATH` if the default is older (`export PATH="/opt/homebrew/opt/node@26/bin:$PATH"`). `HANDBOOK.md` in `node_modules/@eurth/style/` wins over anything here.

Where things are:

- `src/tool/`: the timeline's logic as plain TypeScript (no DOM), and the two Svelte components that draw it, `Timeline.svelte` and `Chart.svelte`. `engine.ts` is the only file that imports `@eurth/calendar`.
- `src/content/`: the guide, the glossary and the three examples, as data.
- `src/pages/`: Timeline, Examples, Guide, Glossary, the embed page and the 404 page.
- `tests/`: the logic, the words, the exports, the built pages, and the suite's shared checks (`shell.test.js`).

## Next

### Before the door

- **A bare page for embeds, in `@eurth/style`.** The handbook's checks ask every page for the shared shell, so the embed page (`/embed/?t=…`) carries the header and footer inside its frame. It works and it is honest, but a timeline in a forum post wants less. The handbook is silent on embeds, so this is a request to `@eurth/style` (a `Page` without the shell, still under the same headers), not something to work around here.
- **Try it with the real calendar maker,** once that site exists: its "Use in a timeline" link should open `time.eurth.org/?cal=…`, and Time should show an empty timeline in that calendar. The reading side is tested against the package's own packed form.
- **Hands and ears.** Pinch to zoom and dragging a thing along the axis on a real phone, a pass with a screen reader over the chart's listbox, and a real sheet of paper from the print dialogue. All are built to the standards, checked by axe and tried with a mouse and a keyboard in a desktop browser; none has been tried on a device.
- **The launch** is `.github/workflows/launch.yml`: it starts at 22:30 UTC on 16 December 2026, builds for the door's time, waits for `LAUNCH_AT` and deploys. If it hasn't started by 22:45 UTC, start it by hand. Afterwards: delete that file, submit the sitemap, and tell the forum.

### Decided

Stijn settled these on 16 November 2026. They are how Time works, not open questions.

1. **Dynasty reigns.** The profile's `dynasty` section holds no dates, so Time reads a `reigns` list from it when Dynasty writes one (a name, `from`, and `to` unless still reigning; years, compact dates or dates in words) and offers "Add the reigns of…" when it finds one. Until then nothing shows. The shape asked for is in the shared notes of the sessions that built the tools.
2. **The whole timeline in the profile.** The handbook says a section is small; the brief says any timeline can be saved in the profile, since a long one can't fit a link. Time follows the brief the way Calendar does: the schema's own small fields as a digest, and the whole timeline under `timeline.definition`. The schema keeps unknown keys, so nothing had to change in `@eurth/profile`.
3. **"Collaborators can add their nation as a track"** (on the mock-up, not in the brief) came after the first version, in 0.2.0: paste a friend's link or pick their profile, and their tracks join yours.
4. **The page is called "Timeline",** as the brief has it, not "Maker" as on the mock-up.

### Later, and what each waits for

Neither of these can be built inside this repository as things stand. Each says what would have to change first, and who decides.

- **Pictures on cards** (a link to an image, shown in an `<img>`). *Waits for `@eurth/style`, and a decision from Stijn.* The suite's content security policy, which `@eurth/style` writes for every tool, lets a page show images from the site itself and nowhere else (`img-src 'self' data: blob:`), and the handbook's first privacy rule is that a tool makes no request to any other address. A picture fetched from a wiki or a forum breaks both. Two ways forward, both outside this repository's say: the handbook and the policy allow images from named Eurth addresses; or pictures are not linked but carried, picked from the device, made small and kept inside the profile file. The second needs no change to the policy, but a timeline with pictures would no longer fit in a link, which is a change to how Time saves; it is a new design, not this item, so it was not built on a guess.
- **A link preview picture per timeline.** *Waits for a Worker, and Stijn's word that Time may have one.* A preview picture has to be at an address a forum or a chat app can fetch, drawn from the timeline in the link: that is code running on the server for every such request. Time is static files only, as the handbook asks of every tool whose brief does not say otherwise, and the free plan's limits (100,000 Worker requests a day and 10 ms of processor time each, for the whole account) are shared by all the tools. The drawing code is ready for it: `timelineSvg` runs anywhere and needs no browser. What is missing is the decision, a Worker script in `wrangler.jsonc`, and a way to turn the SVG into the PNG that link previews want.

## 16 November 2026: 0.2.0, the "Later" list

Eight of the ten things that were under "Later", built one at a time. Still not live: the door is 17 December.

- **Carry things along the axis.** The thing whose card is open can be dragged to another date, and a span or an era by either end; the chart shows it as it goes and records it once, when it is let go, so one undo puts it back. With the keyboard, Alt with Left or Right moves the thing by a day, a month or a year as the zoom has it, and Alt and Shift moves only a span's end. A date stays as fine as it was given: a day moves by days, a year by years, a decade by decades (and correctly across year 1, where round numbers count the other way). An end can never pass its start.
- **Groups of tracks.** Give a track a group (a continent, an alliance): neighbouring tracks of one group are headed by its name, and pressing the name folds them away into a single hollow bar that covers the stretch of time they span and says how much is under it. Folded tracks are left out of the keyboard's round, the pictures and the printed sheets; choosing one of their things in the words below brings the group back. The group travels in the link, the profile and the CSV; what is folded is for the visit only.
- **A second calendar on the axis,** so that two nations can each read the timeline in their own reckoning. Choose the Gregorian calendar or the one in a loaded profile, and the axis gains a second row of labels with round numbers of its own, each row named; a card gives its date in both; the pictures and the printed sheets carry both rows; and the link remembers (`&also=`). Both calendars must be tied to Earth, or there is no reading one in the other.
- **A reality check,** as Flagwright checks a flag. Under the timeline, a list of where the history differs from how things have gone on Earth, each with a button that shows the thing in question: a reign longer than any on record, reigns all of a length or too long on average, a war that runs for generations, a cathedral built in a few years, spans that all last a round number, old dates known to the day, a long past with no doubt in it, and a history made only of events. Lengths are measured in Earth's years, whatever the calendar, and written in the calendar's own. It can't say a history is good; it says what is worth a second look.
- **Print.** What is on screen, on one sheet or spread across up to twelve, each a page of its own with the title, the dates it covers and its place in the run. Spread wider, labels the screen had no room for find room. It goes through the browser's own print dialogue, which is also how it becomes a PDF; paper is light, so the sheets are drawn in the light theme.
- **Tracks from someone else's timeline.** Paste a link or pick a profile, and its tracks and eras join yours; theirs stays as it was. That is how a shared world's history is built without accounts. When the two timelines are in different calendars and both are tied to Earth, the newcomer's dates are turned into yours: a day stays the same day, a month or a year becomes the one its middle falls in, and a decade or century becomes "about" a year. When either calendar has no link to Earth, Time says so and adds nothing.
- **Import from CSV.** The columns the export writes, in any order, or a sheet typed by hand with a title and a date in each row; dates are read from the compact code when it is there, otherwise from the words, in the timeline's calendar. Rows join the track of their name or start a new one, and nothing already there is added twice. What can't be dated is left out, and undo takes the whole import out again.
- **WebP beside PNG** for the picture, in the same sizes. A browser that can't make a WebP hands back a PNG, and Time says so and names the file for what it is.
- **Checked:** 309 tests now (CSV there and back, calendars converted day for day, decades stepped across year 1, groups in the layout, the sheets, the reality check on every example), the suite's shared checks, and axe with no findings; each feature tried by hand in a desktop browser. The launch is untouched: `launch.yml`, `LAUNCH_AT` and the no-spoilers check are as they were.

## 16 November 2026: 0.1.0, built and waiting for its door

The first version, not yet live.

- **The timeline.** Tracks for a nation, a dynasty, the shared world or anything else, each with spans (a reign, a war, the life of a state; "still going on" is allowed) and events (a single date). Eras across the top. A year axis that zooms from thousands of millions of years down to single days.
- **Dates in the world's own calendar,** through `@eurth/calendar` 1.0.0: its months, its days outside the months, its eras on both sides of year 1. A calendar arrives in a profile or in a `?cal=` link; without one, the Gregorian calendar. Dates are typed as they are written ("17 Harvestmoon 1022 FS", "44 BCE", "1022-09-17"), and a date that doesn't exist gets a plain explanation with examples that do.
- **Uncertain dates, shown as such:** "c. 1650", "1650s", "17th century". A loose event has a hollow marker and a bracket as wide as its date; a loose end of a span is hollow and dashed; and every place a date is written says "c.".
- **Deep time.** Past the ten million years the calendar engine counts day by day, Time counts in whole years, as far as a hundred thousand million either way.
- **The card.** Choose an event or a span to see its title, date, text and links, and to change them: label, dates, track, text, tone and up to four https links. Undo and redo, for the visit.
- **Keyboard.** The chart is a list to choose from: left and right along a track, up and down to the nearest thing in time on the next, Page Up and Down through everything, Enter to open the card, Escape to close it, plus and minus to zoom, nought to show all, Shift with the arrows to slide.
- **The timeline in words,** on the page: a summary, then every era, span and event in the order things happened, each with a full-size button that selects it on the chart. It is what a screen reader reads, what a search engine reads, and what "Copy description" copies.
- **Never colour alone.** Every span carries its label on the bar or beside it; tones are a help to the eye, named in words in the picker, and drawn from the suite's text colours so that a label on a bar meets the same 7:1 as text on the page, in both themes.
- **Saving.** A short timeline lives in its link (`?t=1.…`, with its calendar in `?cal=`). Any timeline saves in the nation's profile file, in the `timeline` section: a digest any tool can quote, and the whole timeline. Time reads `calendar` and `dynasty` and writes neither.
- **Exports.** SVG and PNG of the visible range in the theme on screen (PNG also in the suite's six sharing sizes), a sortable wiki table for a history section, CSV, an iframe to embed on eurth.org, Copy description, Copy picture and the suite's share dialog.
- **The signature touch:** axis labels fade in as they find room and out as they lose it, like place names on a map; at rest a label is wholly there or wholly gone, so it always reads. The steps between labelled years nest (1, 5, 10, 50…), so zooming in only ever adds labels.
- **The easter egg:** date something before the Big Bang.
- **Pages:** Timeline, Examples (three invented histories in three calendars: Gregorian, the Selunnan Reckoning and the Kharan Long Year), Guide (how to build a believable history: causes and consequences, parallel tracks, three speeds of time, how long things really take, with a source for every figure) and Glossary (31 terms).
- **The suite's kit,** from `@eurth/style` 1.0.1 and its starter: Astro pages with the tool as a Svelte island, the shared header and footer, security headers, service worker, manifest, sitemap, and the workflows for CI, the nightly rebuild and the launch.
- **Checked:** 249 tests (dates round-trip in five calendars, hostile links and files, the layout at any zoom, every export, the built pages, the profile against the real `@eurth/profile`), the suite's shared checks (contrast, headers, privacy, no spoilers, pages, launch date), axe on every page in both themes with no findings, and Lighthouse within the suite's limits in CI.

## 14 November 2026: groundwork (no release)

- The brief saved as `CLAUDE.md`; the public repository eurth-org/eurth-time created.
- Read the sibling projects as they stood that evening (eurth-style, eurth-profile, eurth-calendar, eurth-flag and the mock-up board) and wrote the plan, which Stijn agreed to.
- The core, as plain TypeScript with tests and no site: dates behind a small interface, with a stand-in engine until `@eurth/calendar` was released later that night; the model; the axis and the layout; the words; saving; the exports; the guide, glossary and examples.

## Not planned

- **Accounts, a server or live editing together.** A timeline lives in its link or in the profile file. Sharing it means sharing one of those.
- **Browser storage.** No local storage, cookies or IndexedDB. "Save" is a link or a download.
- **Times of day.** The smallest step is a day. A battle that turns at noon says so in its text.
- **Real-world history as ready-made data.** The examples are invented. Plenty of sites chart Earth's history; this one is for worlds that don't exist.
- **AI-written histories.** The guide teaches how to write one; the tool doesn't write it for you.
- **Converting between two invented calendars that share no link to Earth.** There is nothing to convert through.
- **A compressed link.** Packing a longer timeline into a link would need the browser's stream compression, which makes reading a link a wait; a long timeline belongs in the profile file.
- **Trackers and analytics.**
