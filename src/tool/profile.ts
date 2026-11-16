/**
 * Time and the Eurth profile (<nation>.eurth.json).
 *
 * Time owns the "timeline" section and writes nothing else. The section holds two things: the
 * handful of plain fields the profile's schema describes (title, first and last year, up to
 * 200 key events), so any tool can quote the history without this code, and under `definition`
 * the whole timeline, calendar included, which is what Time opens. It is the way to save a
 * timeline that is too long for a link.
 *
 * Time reads two other sections and never writes them: "calendar" (owned by Calendar), to date
 * a new timeline in the nation's own reckoning, and "dynasty" (owned by Dynasty), whose reigns
 * can become spans.
 *
 * Use @eurth/profile to read and write the file itself; this module only makes and reads
 * sections. Everything read here is someone else's input and is cleaned before use.
 */
import { yearOf } from './dates';
import { describeTimeline } from './describe';
import { cleanCalendar, engineFor, isCalendar, type CalendarData, type DateEngine } from './engine';
import { cleanDate, compareDates, dateRange, parseDate, type FuzzyDate } from './fuzzy';
import { extentOf } from './layout';
import { LIMITS, type Span, type Timeline, type Track } from './model';
import { cleanText, normalizeTimeline, type Issue } from './normalize';

/** What the profile's schema allows in the plain fields. */
const SCHEMA = { year: 1_000_000, events: 200, title: 80, eventTitle: 200, summary: 600, link: 4000, reigns: 200 };

/** The "timeline" section as Time writes it. A type, not an interface, so that it fits the profile's open sections. */
export type TimelineSection = {
  /** The timeline's share link on time.eurth.org, when it is short enough to have one. */
  link?: string;
  /** One sentence about the timeline. */
  summary: string;
  /** When the section was written, as an ISO date and time. */
  updated: string;
  title: string;
  /** The first and last year the timeline covers. Left out when they are beyond what the schema holds. */
  startYear?: number;
  endYear?: number;
  /** The key events, earliest first: a short list for other tools to quote. */
  events: { year: number; title: string }[];
  /** The whole timeline. */
  definition: Timeline;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const inSchema = (year: number): boolean => Number.isInteger(year) && Math.abs(year) <= SCHEMA.year;

/** At most `max` of a list, spread evenly, keeping the first and the last. */
function sample<T>(list: readonly T[], max: number): T[] {
  if (list.length <= max) return [...list];
  return Array.from({ length: max }, (_, i) => list[Math.round((i * (list.length - 1)) / (max - 1))]!);
}

/**
 * The profile section for a timeline.
 * @param options.link the timeline's share link; kept only if it is an https link of at most 4000 characters
 * @param options.updated when it was written (default: now)
 */
export function toProfileSection(timeline: Timeline, options: { link?: string; updated?: Date } = {}): TimelineSection {
  const clean = normalizeTimeline(timeline).timeline;
  const engine = engineFor(clean.calendar);
  const all = clean.tracks
    .flatMap((track) => track.events)
    .filter((event) => inSchema(event.date.year))
    .sort((a, b) => compareDates(engine, a.date, b.date));
  const section: TimelineSection = {
    summary: cleanText(describeTimeline(clean, engine).summary, SCHEMA.summary),
    updated: (options.updated ?? new Date()).toISOString().replace(/\.\d+Z$/, 'Z'),
    title: clean.title,
    events: sample(all, SCHEMA.events).map((event) => ({ year: event.date.year, title: event.title })),
    definition: JSON.parse(JSON.stringify(clean)) as Timeline,
  };
  const extent = extentOf(clean, engine);
  if (extent !== null) {
    const startYear = yearOf(engine, extent.first);
    const endYear = yearOf(engine, extent.last);
    if (inSchema(startYear)) section.startYear = startYear;
    if (inSchema(endYear)) section.endYear = endYear;
  }
  if (options.link !== undefined && /^https:\/\/[!-~]+$/.test(options.link) && options.link.length <= SCHEMA.link) {
    return { link: options.link, ...section };
  }
  return section;
}

/**
 * The timeline in a profile's "timeline" section. Reads the whole timeline when it is there;
 * otherwise builds one track from the section's plain fields (title, events by year), dated in
 * the calendar given, so a section written by hand or by another tool still opens. Null when
 * there is nothing to build from.
 */
export function fromProfileSection(section: unknown, calendar: CalendarData = null): { timeline: Timeline; issues: Issue[] } | null {
  if (!isRecord(section)) return null;
  if (isRecord(section.definition)) return normalizeTimeline(section.definition);
  if (!Array.isArray(section.events) || section.events.length === 0) return null;
  const title = cleanText(section.title, LIMITS.title);
  return normalizeTimeline({
    title,
    calendar,
    tracks: [
      {
        name: title === '' ? 'History' : title,
        kind: 'nation',
        events: section.events.slice(0, SCHEMA.events).map((event) => (isRecord(event) ? { title: event.title, date: { year: event.year } } : null)),
      },
    ],
  });
}

/**
 * The calendar in a profile's "calendar" section, in @eurth/calendar's shape: the full
 * definition when Calendar wrote one, otherwise a plain calendar from the section's simple
 * fields (months, weekdays, era). Null when there is no usable calendar, which means Gregorian.
 */
export function calendarFromSection(section: unknown): CalendarData {
  if (!isRecord(section)) return null;
  if (isCalendar(section.definition)) return cleanCalendar(section.definition);
  return cleanCalendar({ name: section.name, era: section.era, months: section.months, weekdays: section.weekdays });
}

/** A date as another tool might write it: a year as a number, the compact text, a date in words, or the object. */
function looseDate(engine: DateEngine, value: unknown): FuzzyDate | null {
  if (typeof value === 'number') return cleanDate(engine, { year: value })?.date ?? null;
  if (typeof value === 'string') return cleanDate(engine, value)?.date ?? parseDate(engine, value);
  return cleanDate(engine, value)?.date ?? null;
}

const firstOf = (record: Record<string, unknown>, keys: string[]): unknown => keys.map((key) => record[key]).find((value) => value !== undefined && value !== null);

/**
 * The reigns in a profile's "dynasty" section, as a track of spans. Time reads a `reigns` list
 * when Dynasty writes one: each reign a name with `from` and, unless still reigning, `to`, as a
 * year, a date in the calendar's compact form, or a date in words. Null when the section has no
 * reigns with dates, which is the case for a section that only names the monarch and the heir.
 */
export function reignsFromDynasty(section: unknown, engine: DateEngine): Track | null {
  if (!isRecord(section) || !Array.isArray(section.reigns)) return null;
  const spans: Span[] = [];
  for (const reign of section.reigns.slice(0, SCHEMA.reigns)) {
    if (!isRecord(reign)) continue;
    const label = cleanText(firstOf(reign, ['name', 'monarch', 'title', 'label']), LIMITS.label);
    const from = looseDate(engine, firstOf(reign, ['from', 'start', 'began']));
    if (label === '' || from === null) continue;
    const end = firstOf(reign, ['to', 'end', 'ended']);
    let to = end === undefined ? null : looseDate(engine, end);
    let start = from;
    if (to !== null && dateRange(engine, to).last < dateRange(engine, from).first) [start, to] = [to, from];
    spans.push({ label, from: start, to, text: cleanText(firstOf(reign, ['text', 'note', 'summary']), LIMITS.text), links: [], tone: 0 });
  }
  if (spans.length === 0) return null;
  spans.sort((a, b) => compareDates(engine, a.from, b.from));
  // Reigns that follow one another alternate between two tones, so that neighbours differ by more than their labels.
  spans.forEach((span, i) => (span.tone = i % 2));
  return { name: cleanText(section.house, LIMITS.name) || 'Dynasty', kind: 'dynasty', group: '', spans: spans.slice(0, LIMITS.spans), events: [] };
}

/** What a profile offers Time. */
export interface FromProfile {
  /** The timeline to open: the profile's own, or an empty one in the profile's calendar. */
  timeline: Timeline;
  issues: Issue[];
  /** Whether the profile held a timeline. */
  found: boolean;
  /** The calendar in the profile's "calendar" section, which may differ from the one the timeline was dated in. Null when there is none. */
  profileCalendar: CalendarData;
  /** The reigns in the profile's "dynasty" section, ready to add as a track; null when there are none. */
  reigns: Track | null;
}

/**
 * Everything Time takes from a profile. The profile should already have been checked by
 * @eurth/profile; this reads it defensively all the same.
 */
export function readProfile(profile: unknown): FromProfile {
  const sections = isRecord(profile) ? profile : {};
  const profileCalendar = calendarFromSection(sections.calendar);
  const read = fromProfileSection(sections.timeline, profileCalendar);
  const { timeline, issues } = read ?? normalizeTimeline({ calendar: profileCalendar });
  return { timeline, issues, found: read !== null, profileCalendar, reigns: reignsFromDynasty(sections.dynasty, engineFor(timeline.calendar)) };
}
