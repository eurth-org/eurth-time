/**
 * Dates from one calendar in another.
 *
 * Two calendars can be compared when both say which day of Earth's calendar their first day is:
 * then a day in one is a day in the other, a fixed number of days apart. A calendar with no
 * such link stands alone, and its dates can't be turned into any other's: there is nothing to
 * convert through.
 *
 * A day becomes a day. Looser dates can only be carried over loosely: a month becomes the month
 * its middle falls in, a year the year its middle falls in, and a decade or a century, which
 * is a round number in one calendar and not in the other, becomes "about" the year of its middle.
 */
import type { View } from './axis';
import { canConvert, engineFor, sameCalendar, type CalendarData, type DateEngine } from './engine';
import { dateOfDay, dateRange, precisionOf, type FuzzyDate } from './fuzzy';
import type { Timeline } from './model';
import { normalizeTimeline } from './normalize';

export { canConvert, sameCalendar };

/** A day number of one calendar as a day number of the other. Both must be tied to Earth. */
export const convertDay = (from: DateEngine, to: DateEngine, days: number): number => (from === to ? days : days + (from.earth ?? 0) - (to.earth ?? 0));

/** The same stretch of time, in the other calendar's day numbers: for drawing a second axis. Both must be tied to Earth. */
export const viewIn = (from: DateEngine, to: DateEngine, view: View): View => ({ start: convertDay(from, to, view.start), end: convertDay(from, to, view.end), width: view.width });

/** A date of one calendar in the other, as exactly as it can be said there. Both must be tied to Earth. */
export function convertDate(from: DateEngine, to: DateEngine, date: FuzzyDate): FuzzyDate {
  if (from === to) return date;
  const range = dateRange(from, date);
  const precision = precisionOf(date);
  const middle = convertDay(from, to, Math.floor((range.first + range.last) / 2));
  const converted: FuzzyDate =
    precision === 'day' ? dateOfDay(to, convertDay(from, to, range.first), 'day') : dateOfDay(to, middle, precision === 'month' ? 'month' : 'year');
  if (date.circa === true || precision === 'decade' || precision === 'century') converted.circa = true;
  return converted;
}

/**
 * A timeline with every date turned into another calendar. `converted` says whether anything
 * had to change; a timeline already in that calendar comes back as it is. Null when the dates
 * can't be turned: one of the two calendars has no link to Earth.
 */
export function convertTimeline(timeline: Timeline, calendar: CalendarData): { timeline: Timeline; converted: boolean } | null {
  if (sameCalendar(timeline.calendar, calendar)) return { timeline, converted: false };
  const from = engineFor(timeline.calendar);
  const to = engineFor(calendar);
  if (!canConvert(from, to)) return null;
  const turn = (date: FuzzyDate | null): FuzzyDate | null => (date === null ? null : convertDate(from, to, date));
  const draft = {
    ...timeline,
    calendar,
    eras: timeline.eras.map((era) => ({ ...era, from: turn(era.from), to: turn(era.to) })),
    tracks: timeline.tracks.map((track) => ({
      ...track,
      spans: track.spans.map((span) => ({ ...span, from: turn(span.from), to: turn(span.to) })),
      events: track.events.map((event) => ({ ...event, date: turn(event.date) })),
    })),
  };
  return { timeline: normalizeTimeline(draft).timeline, converted: true };
}
