/**
 * The one door between Time and what counts its days: @eurth/calendar.
 *
 * Everything in Time works in day numbers: a whole number, 0 for day 1 of year 1, the count
 * @eurth/calendar uses. A DateEngine is the little a timeline needs to know about a calendar to
 * turn dates into day numbers and back: where each year starts, what a year is made of, and what
 * its months and eras are called. engineFor() makes one from a calendar definition; every other
 * file in Time talks to the engine and never to the package, so this is the only file that
 * changes if the package ever does.
 */
import {
  createCalendar,
  decodeCalendar as decodePacked,
  encodeCalendar as encodePacked,
  GREGORIAN,
  gregorianToRataDie,
  normalizeCalendar,
  shortName,
  type Calendar,
  type CalendarDefinition,
} from '@eurth/calendar';

export { CALENDAR_PARAM } from '@eurth/calendar';

/** One stretch of a year: a month, or a block of days that belongs to no month. */
export interface YearPart {
  kind: 'month' | 'intercalary';
  /** Which month or block (1-based). */
  index: number;
  name: string;
  /** Its length in this year. May be 0 for a block that only exists in leap years. */
  days: number;
  /** The day number of its first day. */
  start: number;
}

/** What Time needs from a calendar. */
export interface DateEngine {
  /** What the calendar is called. */
  readonly name: string;
  /** The label after a year from year 1 on ("FS"). May be empty. */
  readonly era: string;
  /** The label for years before year 1 ("Before the Founding"). When empty those years are 0, -1, -2. */
  readonly eraBefore: string;
  /** The months, in order, with a short form for tight spaces. */
  readonly months: readonly { name: string; short: string }[];
  /** The blocks of days outside the months. `single` marks one that is never more than a day long. */
  readonly intercalary: readonly { name: string; single: boolean }[];
  /** The first and last year the engine counts day by day. Beyond them Time counts in whole years. */
  readonly minYear: number;
  readonly maxYear: number;
  /** The average length of a year in days, leap years included. */
  readonly meanYear: number;
  /**
   * Where this calendar's day 0 falls in Earth's count of days, in which day 0 is 1 January of
   * year 1 of the Gregorian calendar. Null when the calendar has no link to Earth, and then its
   * dates can't be turned into any other calendar's.
   */
  readonly earth: number | null;
  /** The day number of the first day of a year, from minYear to maxYear + 1. */
  yearStart(year: number): number;
  /** The year a day number falls in. */
  yearOf(days: number): number;
  /** The year laid out: its months and blocks in order, with their lengths that year. */
  parts(year: number): YearPart[];
}

/** A calendar definition, as @eurth/calendar has it. Null means the Gregorian calendar. */
export type CalendarData = CalendarDefinition | null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Whether a value can be used as a calendar: it has at least one month with a name. The
 * package would make a calendar out of anything, by adding a month where there is none; a
 * timeline is better served by the Gregorian calendar than by a year of one made-up month.
 */
export function isCalendar(calendar: unknown): calendar is Record<string, unknown> {
  return isRecord(calendar) && Array.isArray(calendar.months) && calendar.months.some((month) => isRecord(month) && typeof month.name === 'string' && month.name.trim() !== '');
}

/** A clean copy of a calendar from anywhere, as plain data, or null when it is not a calendar. Never throws. */
export function cleanCalendar(calendar: unknown): CalendarData {
  if (!isCalendar(calendar)) return null;
  try {
    return JSON.parse(JSON.stringify(normalizeCalendar(calendar).calendar)) as CalendarDefinition;
  } catch {
    return null;
  }
}

/** The day 0 of a calendar in Earth's count, from the Gregorian date the calendar gives for it. */
function earthOf(calendar: Calendar): number | null {
  const first = calendar.linked ? calendar.toGregorian(0) : null;
  // The package counts days from 1 (rata die); Time counts from 0, as it does in every calendar.
  return first === null ? null : gregorianToRataDie(first) - 1;
}

function wrap(calendar: Calendar): DateEngine {
  const definition = calendar.definition;
  return {
    name: definition.name,
    era: definition.era,
    eraBefore: definition.eraBefore,
    months: definition.months.map((month) => ({ name: month.name, short: shortName(month.name, month.short) })),
    intercalary: definition.intercalary.map((block, i) => ({ name: block.name, single: calendar.longestIntercalary(i + 1) <= 1 })),
    minYear: calendar.minYear,
    maxYear: calendar.maxYear,
    meanYear: calendar.meanYear,
    earth: earthOf(calendar),
    yearStart: (year) => calendar.yearStart(year),
    yearOf: (days) => calendar.yearOf(days),
    parts: (year) => calendar.year(year).parts.map((part) => ({ kind: part.kind, index: part.index, name: part.name, days: part.days, start: part.start })),
  };
}

const gregorian = wrap(createCalendar(GREGORIAN));

/** The Gregorian calendar's own definition: what a timeline with no calendar is dated in. */
export const GREGORIAN_CALENDAR: CalendarDefinition = GREGORIAN;
const engines = new WeakMap<object, DateEngine>();

/**
 * The engine for a calendar definition. Null, or anything that is not a usable calendar, gives
 * the Gregorian calendar. Never throws. Asking twice for the same definition gives the same engine.
 */
export function engineFor(calendar: unknown): DateEngine {
  if (!isCalendar(calendar)) return gregorian;
  let engine = engines.get(calendar);
  if (engine === undefined) {
    engine = wrap(createCalendar(calendar));
    engines.set(calendar, engine);
  }
  return engine;
}

/**
 * Whether two calendar definitions are one and the same. No calendar at all is the Gregorian
 * calendar, so it is the same as the Gregorian calendar by name.
 */
export function sameCalendar(a: CalendarData, b: CalendarData): boolean {
  return a === b || JSON.stringify(a ?? GREGORIAN_CALENDAR) === JSON.stringify(b ?? GREGORIAN_CALENDAR);
}

/** Whether dates in one calendar can be turned into the other: both are tied to Earth, or they are the same engine. */
export const canConvert = (from: DateEngine, to: DateEngine): boolean => from === to || (from.earth !== null && to.earth !== null);

const toBase64Url = (text: string): string => {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): string => {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
};

/** "<version>.<JSON as base64url>": the form every Eurth link uses. */
export function encodeJson(value: unknown, version = 1): string {
  return `${version}.${toBase64Url(JSON.stringify(value))}`;
}

/** Reads what encodeJson writes. Null for anything else; never throws. */
export function decodeJson(text: unknown, maxLength: number): { version: number; value: unknown } | null {
  if (typeof text !== 'string' || text.length > maxLength) return null;
  const found = /^(\d{1,4})\.([A-Za-z0-9_-]*)$/.exec(text);
  if (!found) return null;
  try {
    return { version: Number(found[1]), value: JSON.parse(fromBase64Url(found[2]!)) };
  } catch {
    return null;
  }
}

/** A calendar as the text of a `cal` parameter: the packed form the calendar maker's "Use in a timeline" link carries. */
export function encodeCalendar(calendar: CalendarDefinition): string {
  return encodePacked(calendar);
}

/** The calendar in the text of a `cal` parameter, or null when there is none to be read. */
export function decodeCalendar(text: unknown): CalendarData {
  const decoded = decodePacked(text);
  return decoded === null ? null : cleanCalendar(decoded.calendar);
}
