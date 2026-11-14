/**
 * A timeline in a link.
 *
 * Nothing is stored anywhere: a short timeline lives in its address, in the query string so a
 * Worker could read it one day. The timeline is packed tightly (short keys, lists instead of
 * objects, nothing that is at its default) and written as "<version>.<base64url>", the form
 * every Eurth link uses:
 *
 *   https://time.eurth.org/?t=1.eyJuIjoi…&cal=1.eyJtIjpb…
 *
 * `t` is the timeline and `cal` its calendar, the same text cal.eurth.org's "Use in a timeline"
 * link carries; without `cal` the dates are Gregorian. A link is someone else's input: whatever
 * arrives is cleaned by normalizeTimeline, so a mangled or hostile link gives a tidy timeline
 * or nothing, never an error. A timeline too long for a link is saved in the profile file
 * instead (profile.ts).
 */
import { CALENDAR_PARAM, decodeCalendar, decodeJson, encodeCalendar, encodeJson, type CalendarData } from './engine';
import { encodeDate, type FuzzyDate } from './fuzzy';
import { TIMELINE_VERSION, TRACK_KINDS, type Link, type Timeline } from './model';
import { normalizeTimeline, type Issue } from './normalize';

/** The query parameter that carries a timeline. */
export const TIMELINE_PARAM = 't';

/** The longest link Time hands out. Longer than this and browsers, forums and chat apps start to cut links short. */
export const MAX_LINK_LENGTH = 8000;

/** The longest timeline text read from a link. */
export const MAX_TIMELINE_TEXT = 100_000;

type Packed = (string | number | Packed)[];

const date = (value: FuzzyDate | null): string => (value === null ? '' : encodeDate(value));

const links = (list: readonly Link[]): Packed => list.map((link) => [link.label, link.url]);

/** Drops what is empty from the end of a list. */
function trim(list: Packed): Packed {
  let end = list.length;
  while (end > 0) {
    const last = list[end - 1]!;
    if (last === '' || (Array.isArray(last) && last.length === 0)) end--;
    else break;
  }
  return list.slice(0, end);
}

/**
 * The packed form:
 *   n  the title
 *   e  eras: [label, from, to]
 *   k  tracks: [name, kind as 0 to 3, spans, events]
 *        span:  [label, from, to, tone, text, links]
 *        event: [title, date, text, links]
 *        link:  [label, address]
 * Dates are compact text (see encodeDate); an open end is an empty text; whatever is empty at
 * the end of a list is left off.
 */
function pack(timeline: Timeline): Record<string, unknown> {
  const packed: Record<string, unknown> = {};
  if (timeline.title !== '') packed.n = timeline.title;
  if (timeline.eras.length > 0) packed.e = timeline.eras.map((era) => trim([era.label, date(era.from), date(era.to)]));
  if (timeline.tracks.length > 0) {
    packed.k = timeline.tracks.map((track) =>
      trim([
        track.name,
        TRACK_KINDS.indexOf(track.kind),
        track.spans.map((span) => trim([span.label, date(span.from), date(span.to), span.tone, span.text, links(span.links)])),
        track.events.map((event) => trim([event.title, date(event.date), event.text, links(event.links)])),
      ]),
    );
  }
  return packed;
}

const rows = (value: unknown): unknown[][] => (Array.isArray(value) ? value.filter((row): row is unknown[] => Array.isArray(row)) : []);

const unpackLinks = (value: unknown): unknown[] => rows(value).map(([label, url]) => ({ label, url }));

/** The packed form opened out into the shape of a timeline, unchecked. */
function unpack(packed: Record<string, unknown>, calendar: CalendarData): unknown {
  return {
    title: packed.n,
    calendar,
    eras: rows(packed.e).map(([label, from, to]) => ({ label, from, to: to === '' ? null : to })),
    tracks: rows(packed.k).map(([name, kind, spans, events]) => ({
      name,
      kind: typeof kind === 'number' ? TRACK_KINDS[kind] : undefined,
      spans: rows(spans).map(([label, from, to, tone, text, list]) => ({ label, from, to: to === '' ? null : to, tone, text, links: unpackLinks(list) })),
      events: rows(events).map(([title, when, text, list]) => ({ title, date: when, text, links: unpackLinks(list) })),
    })),
  };
}

/** A timeline as link text: "1.eyJuIjoi…". The calendar travels beside it: see timelineLink. */
export function encodeTimeline(timeline: Timeline): string {
  return encodeJson(pack(timeline), TIMELINE_VERSION);
}

/**
 * Reads link text back into a timeline in the calendar given. Null when the text is not a
 * timeline at all (too long, malformed, from a version this code does not know); otherwise a
 * clean timeline and a list of whatever had to be put right.
 */
export function decodeTimeline(text: unknown, calendar: CalendarData = null): { timeline: Timeline; issues: Issue[] } | null {
  const decoded = decodeJson(text, MAX_TIMELINE_TEXT);
  if (decoded === null || decoded.version !== TIMELINE_VERSION) return null;
  const packed = decoded.value;
  if (typeof packed !== 'object' || packed === null || Array.isArray(packed)) return null;
  return normalizeTimeline(unpack(packed as Record<string, unknown>, calendar));
}

/**
 * The link for a timeline: the address given, with the timeline and its calendar as its only
 * query parameters. An empty timeline in the Gregorian calendar is the plain address.
 */
export function timelineLink(base: string, timeline: Timeline): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  const empty = timeline.title === '' && timeline.eras.length === 0 && timeline.tracks.length === 0;
  if (!empty) url.searchParams.set(TIMELINE_PARAM, encodeTimeline(timeline));
  if (timeline.calendar !== null) url.searchParams.set(CALENDAR_PARAM, encodeCalendar(timeline.calendar));
  return url.toString();
}

/** Whether a link is short enough to hand out. When it is not, the timeline belongs in a profile file. */
export const linkFits = (link: string): boolean => link.length <= MAX_LINK_LENGTH;

/**
 * The timeline a link carries. Takes a whole address or just its query string. A link with a
 * calendar and no timeline (as cal.eurth.org's "Use in a timeline" makes) gives an empty
 * timeline in that calendar. Null when the link carries neither.
 */
export function timelineFromLink(link: string): { timeline: Timeline; issues: Issue[] } | null {
  let search: string;
  try {
    search = link.includes('://') ? new URL(link).search : link;
  } catch {
    return null;
  }
  const params = new URLSearchParams(search);
  const calendarText = params.get(CALENDAR_PARAM);
  const timelineText = params.get(TIMELINE_PARAM);
  if (calendarText === null && timelineText === null) return null;
  const calendar = decodeCalendar(calendarText);
  const issues: Issue[] = [];
  if (calendarText !== null && calendar === null) {
    issues.push({ path: 'calendar', message: 'The calendar in this link could not be read, so the dates are shown in the Gregorian calendar.' });
  }
  if (timelineText === null) {
    const empty = normalizeTimeline({ calendar });
    return { timeline: empty.timeline, issues: [...issues, ...empty.issues] };
  }
  const decoded = decodeTimeline(timelineText, calendar);
  if (decoded === null) return null;
  return { timeline: decoded.timeline, issues: [...issues, ...decoded.issues] };
}
