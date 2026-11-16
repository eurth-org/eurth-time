# Time

> A friendly note: this tool is part of Eurth's advent calendar, and its door opens on 17 December. Please don't spoil the surprise before then.

Time is a history timeline maker for fictional worlds, for time.eurth.org. Give each nation, dynasty or the shared world a track; add reigns, wars and eras as spans and single days as events; and read it all on an axis that zooms from millennia down to days, dated in the world's own calendar.

It is one of the free worldbuilding tools by [Eurth](https://eurth.org), a worldbuilding and roleplay community since 2004. No ads, no analytics, no cookies and no accounts: a timeline lives in its link, or in your nation's profile file.

What's next, what each release added and what's not planned is in the [roadmap](roadmap.md). What people asked for and what became of it is in the [feedback log](docs/feedback-log.md).

## Using it

- **Add** a track, then events and spans on it. A new thing lands in the middle of what is on screen and opens for editing.
- **Type dates as you would write them:** `17 Harvestmoon 1022 FS`, `March 1869`, `1789`, `44 BCE`. For a date you only half know: `c. 1650`, `1650s`, `17th century`.
- **Move through time:** drag to slide, pinch or hold Ctrl and use the wheel to zoom, or use the buttons. With the keyboard: arrow keys from one thing to the next, Enter for its card, plus and minus to zoom, nought to see everything.
- **Move things:** drag the thing whose card is open to another date, or a span by either end. With the keyboard, Alt with Left or Right; with Shift as well, only a span's end.
- **Groups:** give neighbouring tracks the same group (a continent, an alliance) and press its name to fold them away.
- **Your own calendar:** load a nation profile that has one, or follow a "Use in a timeline" link from the calendar maker. Without one, dates are Gregorian. A second calendar can label the axis as well, when both are tied to Earth's.
- **A friend's nation beside yours:** paste their link or pick their profile, and their tracks join your timeline, with their dates turned into your calendar where that can be done.
- **A second opinion:** the reality check under the timeline says where the history differs from how long things have really taken.
- **Save:** copy the link (it holds the whole timeline), or save the profile file when the history has outgrown a link.
- **Take it with you:** SVG, PNG and WebP of what is on screen, print across up to twelve sheets (or save that as a PDF), a wiki table for a history section, CSV out and in, or an iframe for a page on eurth.org.

## How it fits with the other tools

- Dates come from [`@eurth/calendar`](https://github.com/eurth-org/eurth-calendar), the engine behind the calendar maker.
- A timeline is saved in the `timeline` section of the [Eurth profile](https://github.com/eurth-org/eurth-profile), `<nation>.eurth.json`. Time reads the profile's `calendar` and `dynasty` sections and writes only its own: a digest any tool can quote (`title`, `startYear`, `endYear`, up to 200 `events`) and the whole timeline under `definition`.
- The look, the header and footer, sharing, the checks and the rules every tool follows come from [`@eurth/style`](https://github.com/eurth-org/eurth-style). Its `HANDBOOK.md` wins over anything in this repository on what the tools share.

## Development

Node 22.12 or newer; CI runs on Node 26.

```sh
npm install
npm run dev       # the site, with live reload
npm run check     # types
npm run build     # the static site, into dist/
npm test          # Vitest: the logic, the words, the exports, and the built pages
npm run axe       # accessibility checks on every built page, in both themes
npm run preview   # the built site with its real headers, on wrangler dev
npm run images    # the favicon, icons and sharing image, into public/
```

Build before you test: several tests read `dist/`.

- `src/tool/` is the timeline. The logic is plain TypeScript with no DOM: `engine.ts` (the one door to `@eurth/calendar`), `fuzzy.ts` (dates as people write them), `model.ts`, `normalize.ts` (whatever arrives from a link or a file is cleaned here), `ops.ts`, `axis.ts` and `layout.ts` (what goes where at a zoom), `describe.ts` (the timeline in words), `nav.ts` (the keyboard), `link.ts`, `profile.ts`, `convert.ts` (dates from one calendar in another), `shift.ts` (moving things in time), `review.ts` (the reality check), and the exports `svg.ts`, `print.ts`, `wikitext.ts`, `csv.ts` and `embed.ts`. `Timeline.svelte` and `Chart.svelte` draw what those work out.
- `src/content/` is the guide, the glossary and the examples, as data, so that the tests can hold them to the house style.
- `src/pages/` is the six pages.
- No colour, font or spacing is written here: everything is a token of `@eurth/style`. `src/tool/theme.ts` says which token each tone is.

A link and a profile file are someone else's input. Nothing from either reaches the page without passing through `normalizeTimeline`, and no text from either is ever used as markup.

## Deployment

The site is static files served by a Cloudflare Worker on its own domain (`wrangler.jsonc`). Nothing deploys before the door opens.

- **The door** is in `LAUNCH_AT`: 17 December 2026 at 00:00 in Brussels. `.github/workflows/launch.yml` starts on the evening before, builds the site as it will be at that moment, waits, and deploys, which creates `time.eurth.org`. If the scheduled run hasn't started by 22:45 UTC on 16 December, start it by hand from the Actions tab.
- **After the door,** every green push to `main` deploys (`ci.yml`), and a nightly run rebuilds the site so its menus gain each newly opened tool (`nightly.yml`). Delete `launch.yml` once the site is live.
- Deploying needs the organisation's `CLOUDFLARE_API_TOKEN` secret; without it the step is skipped with a warning. To deploy by hand: `npm run deploy`.

## Releasing

1. Move what's done out of "Next" in [roadmap.md](roadmap.md) and add a dated section for the release, newest first.
2. Set the version in `package.json` and run `npm install` so the lockfile follows.
3. `npm run check`, `npm run build`, `npm test`, `npm run axe`.
4. Commit and push to `main`. After the door has opened, that is the release.

Made by Orioni for [Eurth](https://eurth.org). Apache 2.0.
