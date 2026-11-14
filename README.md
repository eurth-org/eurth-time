# Time

> A friendly note: this tool is part of Eurth's advent calendar, and its door hasn't opened yet. Please don't spoil the surprise before it does.

Time is a history timeline maker for fictional worlds, for time.eurth.org. Give each nation, dynasty or the shared world a track; add reigns, wars and eras as spans and single days as events; and read it all on an axis that zooms from millennia down to days, dated in the world's own calendar.

It is one of the free worldbuilding tools by [Eurth](https://eurth.org), a worldbuilding and roleplay community since 2004. No ads, no analytics, no cookies and no accounts: a timeline lives in its link, or in your nation's profile file.

## Status

Planning. Nothing is built yet. The [roadmap](roadmap.md) holds the plan, where work stands and exactly where to pick it up, what each release added, and what's not planned.

## How it fits with the other tools

- Dates come from [`@eurth/calendar`](https://github.com/eurth-org/eurth-calendar), the engine behind the calendar maker. Without a calendar, Time uses the Gregorian one.
- A timeline is saved in the `timeline` section of the [Eurth profile](https://github.com/eurth-org/eurth-profile), `<nation>.eurth.json`. Time reads the profile's `calendar` and `dynasty` sections and writes only its own.
- The look, the header and footer, sharing and the rules every tool follows come from [`@eurth/style`](https://github.com/eurth-org/eurth-style) and its handbook.

## Development

Node 22 or newer. The commands arrive with the first code (step 4a of the roadmap).

Made by Orioni for [Eurth](https://eurth.org). Apache 2.0.
