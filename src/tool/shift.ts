/**
 * Moving things in time: by a number of days (a drag) or by one step of a unit (a key).
 *
 * A date keeps the fineness it was given. A day moves by days; a month moves to the month the
 * drag lands in; a year moves by whole years, a decade by decades, a century by centuries.
 * "c." stays "c.". Nothing here changes what it is given: see ops.ts.
 */
import { MAX_YEAR, partsOf } from './dates';
import type { DateEngine } from './engine';
import { cleanDate, dateOfDay, dateRange, precisionOf, spanYears, type FuzzyDate } from './fuzzy';
import type { Era, Ref, Span, Timeline } from './model';
import { getItem } from './model';
import { updateItem } from './ops';

/** Which part of a thing moves: all of it, or one end of a span or an era. */
export type Part = 'all' | 'from' | 'to';

/** The unit one press of a key moves by. */
export type Unit = 'day' | 'month' | 'year';

const fit = (engine: DateEngine, date: FuzzyDate, fallback: FuzzyDate): FuzzyDate => cleanDate(engine, date)?.date ?? fallback;

const withYear = (engine: DateEngine, date: FuzzyDate, year: number): FuzzyDate =>
  fit(engine, { ...date, year: Math.min(MAX_YEAR, Math.max(-MAX_YEAR, year)) }, date);

/**
 * A decade or a century moved by whole decades or centuries. Round numbers count the other way
 * before year 1, so the next one is found from where this one ends, never by adding tens.
 */
function stepSpan(engine: DateEngine, date: FuzzyDate, steps: number): FuzzyDate {
  const size = date.span === 'century' ? 100 : 10;
  // Far from year 1 the count runs evenly, and a walk of a million steps would be a long one.
  if (Math.abs(steps) > 1000) return withYear(engine, date, date.year + steps * size);
  let moved = date;
  for (let i = 0; i < Math.abs(steps); i++) {
    const [first, last] = spanYears(engine, moved);
    const next = withYear(engine, moved, steps > 0 ? last + 1 : first - 1);
    if (next.year === moved.year) break;
    moved = next;
  }
  return moved;
}

/** A date moved by a number of days (later when positive), as finely as it was given. */
export function shiftDate(engine: DateEngine, date: FuzzyDate, days: number): FuzzyDate {
  if (!Number.isFinite(days) || days === 0) return date;
  const precision = precisionOf(date);
  if (precision === 'decade' || precision === 'century') return stepSpan(engine, date, Math.round(days / (engine.meanYear * (precision === 'decade' ? 10 : 100))));
  if (precision === 'year') return withYear(engine, date, date.year + Math.round(days / engine.meanYear));
  const range = dateRange(engine, date);
  const moved = precision === 'day' ? dateOfDay(engine, range.first + Math.round(days), 'day') : dateOfDay(engine, (range.first + range.last) / 2 + days, 'month');
  if (date.circa === true) moved.circa = true;
  return moved;
}

/**
 * A date moved by steps of a unit: a day, a month, a year. A date given less finely than the
 * unit moves by its own measure instead: a year can't move by a day, so it moves by a year,
 * and a decade by ten.
 */
export function stepDate(engine: DateEngine, date: FuzzyDate, unit: Unit, steps: number): FuzzyDate {
  const by = Math.trunc(steps);
  if (by === 0) return date;
  const precision = precisionOf(date);
  if (precision === 'decade' || precision === 'century') return stepSpan(engine, date, by);
  if (precision === 'year' || unit === 'year') return withYear(engine, date, date.year + by);
  if (precision === 'day' && unit === 'day') return shiftDate(engine, date, by);

  // By months: from one part of the year to the next, keeping the day where the month is long enough.
  let year = date.year;
  let parts = partsOf(engine, year).filter((part) => part.days > 0);
  let at = parts.findIndex((part) => (date.month !== undefined ? part.kind === 'month' && part.index === date.month : part.kind === 'intercalary' && part.index === date.intercalary));
  if (at < 0) return date;
  for (let i = 0; i < Math.abs(by); i++) {
    at += Math.sign(by);
    if (at < 0 || at >= parts.length) {
      year += Math.sign(by);
      parts = partsOf(engine, year).filter((part) => part.days > 0);
      if (parts.length === 0) return date;
      at = by > 0 ? 0 : parts.length - 1;
    }
  }
  const part = parts[at]!;
  const moved: FuzzyDate = { year, [part.kind]: part.index };
  if (date.day !== undefined) moved.day = Math.min(date.day, part.days);
  if (date.circa === true) moved.circa = true;
  return fit(engine, moved, date);
}

/**
 * A timeline with one thing moved in time. An event has one date; a span or an era moves
 * whole, or by one end. A move that would put an end before its start, or that changes
 * nothing, gives back the timeline it was given. An open end stays open.
 */
export function moveInTime(timeline: Timeline, engine: DateEngine, ref: Ref, part: Part, change: (date: FuzzyDate) => FuzzyDate): Timeline {
  const item = getItem(timeline, ref);
  if (item === null) return timeline;
  const same = (a: FuzzyDate | null, b: FuzzyDate | null) => JSON.stringify(a) === JSON.stringify(b);
  if ('date' in item) {
    const date = change(item.date);
    return same(date, item.date) ? timeline : updateItem(timeline, ref, { date });
  }
  const stretch: Era | Span = item;
  const from = part === 'to' ? stretch.from : change(stretch.from);
  const to = part === 'from' || stretch.to === null ? stretch.to : change(stretch.to);
  if (same(from, stretch.from) && same(to, stretch.to)) return timeline;
  if (to !== null && dateRange(engine, to).last < dateRange(engine, from).first) return timeline;
  return updateItem(timeline, ref, { from, to });
}
