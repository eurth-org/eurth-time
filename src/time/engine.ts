/**
 * The one door between Time and whatever counts its days.
 *
 * Everything in Time works in day numbers: a whole number, 0 for day 1 of year 1, the same count
 * @eurth/calendar uses. A DateEngine is the little a timeline needs to know about a calendar to
 * turn dates into day numbers and back: where each year starts, what a year is made of, and what
 * its months and eras are called.
 *
 * Until @eurth/calendar 1.0.0 is released, engineFor() builds a plain engine of Time's own
 * (plain.ts) from the same calendar definition. When the package is out, this file is the only
 * one that changes: engineFor() wraps the package's Calendar, and the codec below hands over to
 * encodeCalendar and decodeCalendar. See roadmap.md, step 4h.
 */
import { cleanSpec, GREGORIAN_SPEC, plainEngine } from './plain';

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
  /** The day number of the first day of a year, from minYear to maxYear + 1. */
  yearStart(year: number): number;
  /** The year a day number falls in. */
  yearOf(days: number): number;
  /** The year laid out: its months and blocks in order, with their lengths that year. */
  parts(year: number): YearPart[];
}

/** A calendar definition as it travels: plain JSON, in @eurth/calendar's shape. Null means Gregorian. */
export type CalendarData = Record<string, unknown> | null;

const gregorian = plainEngine(GREGORIAN_SPEC);

/**
 * The engine for a calendar definition. Null, or anything that is not a usable calendar, gives
 * the Gregorian calendar. Never throws.
 */
export function engineFor(calendar: unknown): DateEngine {
  const spec = cleanSpec(calendar);
  return spec === null ? gregorian : plainEngine(spec);
}

/** Whether a value can be used as a calendar. */
export function isCalendar(calendar: unknown): calendar is Record<string, unknown> {
  return cleanSpec(calendar) !== null;
}

/** The query parameter that carries a calendar from cal.eurth.org ("Use in a timeline"). */
export const CALENDAR_PARAM = 'cal';

/** The longest calendar text read from a link. */
export const MAX_CALENDAR_TEXT = 60_000;

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

/**
 * A calendar as the text of a `cal` parameter, and back.
 * For now this is the definition as it stands; from step 4h it is @eurth/calendar's packed form.
 */
export function encodeCalendar(calendar: Record<string, unknown>): string {
  return encodeJson(calendar);
}

export function decodeCalendar(text: unknown): Record<string, unknown> | null {
  const decoded = decodeJson(text, MAX_CALENDAR_TEXT);
  if (decoded === null || decoded.version !== 1) return null;
  return isCalendar(decoded.value) ? decoded.value : null;
}
