/**
 * Years and day numbers, for any engine and for any depth of time.
 *
 * An engine counts day by day across some twenty million years. A timeline may reach further:
 * the first stars, the end of everything. Beyond the engine's range Time counts in whole years
 * of the calendar's average length, which is as exact as anyone can be about a Tuesday four
 * thousand million years ago.
 */
import type { DateEngine, YearPart } from './engine';

/** Years run from -MAX_YEAR to +MAX_YEAR: far enough either way to outlast the universe so far. */
export const MAX_YEAR = 99_999_999_999;

/** The Big Bang, in days before day 0: 13,787 million years of 365.2425 days. */
export const BIG_BANG_DAYS = 13_787_000_000 * 365.2425;

/** A true minus sign, for years before year 1 in a calendar with no name for that time. */
const MINUS = '\u2212';

/** Whether the engine counts this year day by day. */
export const inRange = (engine: DateEngine, year: number): boolean => year >= engine.minYear && year <= engine.maxYear;

/** The day number of the first day of a year, however far away. */
export function yearStart(engine: DateEngine, year: number): number {
  if (year > engine.maxYear + 1) {
    return engine.yearStart(engine.maxYear + 1) + Math.round((year - engine.maxYear - 1) * engine.meanYear);
  }
  if (year < engine.minYear) return engine.yearStart(engine.minYear) - Math.round((engine.minYear - year) * engine.meanYear);
  return engine.yearStart(year);
}

/** The day number of the last day of a year. */
export const yearEnd = (engine: DateEngine, year: number): number => yearStart(engine, year + 1) - 1;

/** The year a day number falls in, however far away. */
export function yearOf(engine: DateEngine, days: number): number {
  const top = engine.yearStart(engine.maxYear + 1);
  const bottom = engine.yearStart(engine.minYear);
  if (days >= bottom && days < top) return engine.yearOf(Math.floor(days));
  let year =
    days >= top
      ? engine.maxYear + 1 + Math.floor((days - top) / engine.meanYear)
      : engine.minYear - Math.ceil((bottom - days) / engine.meanYear);
  year = Math.min(MAX_YEAR, Math.max(-MAX_YEAR, year));
  while (year > -MAX_YEAR && yearStart(engine, year) > days) year--;
  while (year < MAX_YEAR && yearStart(engine, year + 1) <= days) year++;
  return year;
}

/** The months and blocks of a year. Empty for a year the engine does not count day by day. */
export const partsOf = (engine: DateEngine, year: number): YearPart[] => (inRange(engine, year) ? engine.parts(year) : []);

/** Whether years before year 1 have a name of their own and count backwards from 1, as BCE does. */
export const countsBack = (engine: DateEngine): boolean => engine.eraBefore !== '';

/**
 * The number a year is written with: the year itself, or for a year before year 1 in a calendar
 * that counts backwards, how many years before (year 0 is "1 BCE").
 */
export const yearNumber = (engine: DateEngine, year: number): number => (year < 1 && countsBack(engine) ? 1 - year : year);

/** 12,500 rather than 12500; years up to 9999 are left as they are. */
export function groupDigits(n: number): string {
  const digits = String(Math.abs(Math.trunc(n)));
  const grouped = digits.length > 4 ? digits.replace(/\B(?=(\d{3})+$)/g, ',') : digits;
  return n < 0 ? `${MINUS}${grouped}` : grouped;
}

/** 14 bn rather than 14,000,000,000, for axis labels. */
export function compactNumber(n: number): string {
  const size = Math.abs(n);
  const short = (value: number): string => String(Math.round(value * 100) / 100);
  if (size >= 1e9) return `${n < 0 ? MINUS : ''}${short(size / 1e9)} bn`;
  if (size >= 1e6) return `${n < 0 ? MINUS : ''}${short(size / 1e6)} m`;
  return groupDigits(n);
}

/**
 * A year as it is written: "1022 FS", "3 Before the Founding", or "−2 KY" in a calendar with no
 * name for the time before year 1.
 */
export function formatYear(engine: DateEngine, year: number, options: { compact?: boolean; era?: boolean } = {}): string {
  const write = options.compact ? compactNumber : groupDigits;
  const before = year < 1 && countsBack(engine);
  const number = write(yearNumber(engine, year));
  if (options.era === false) return number;
  const label = before ? engine.eraBefore : engine.era;
  return label === '' ? number : `${number} ${label}`;
}

/** "1st", "2nd", "3rd", "4th", "11th", "22nd". */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}
