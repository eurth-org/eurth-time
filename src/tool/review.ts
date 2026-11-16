/**
 * The reality check: a second opinion on a history, as Flagwright gives one on a flag.
 *
 * It looks for the things invented histories get wrong most often, each measured against the
 * real figures in the guide's table (src/content/guide.ts): reigns that outlast any on record,
 * reigns all of a length, wars that run for generations, cathedrals built in a summer, a past
 * with no doubt in it. It can't tell whether a history is good. It can say where one differs
 * from how things have gone on Earth, and leave the author to decide whether that is the point.
 *
 * Lengths are compared in Earth's years, whatever the calendar, since the figures come from
 * Earth; they are written in the calendar's own years, with Earth's beside them when the two
 * differ enough to matter.
 */
import { groupDigits } from './dates';
import type { DateEngine } from './engine';
import { dateRange, isUncertain, precisionOf, type FuzzyDate } from './fuzzy';
import { extentOf } from './layout';
import type { Ref, Span, Timeline } from './model';

/** Something worth a second look. */
export interface Finding {
  /** Which check found it: "long-reign", "even-reigns" and so on. */
  id: string;
  /** What was found and what it is measured against, in a sentence or two. */
  message: string;
  /** The things it is about, to show on the timeline. */
  refs: Ref[];
}

/** The length of Earth's year, in days: the figures the checks use are from Earth. */
const EARTH_YEAR = 365.2425;

/** The longest verified reign of a sovereign: Louis XIV of France, 1643 to 1715. */
const LONGEST_REIGN = 72;

/** Most findings shown at once: a list longer than this is not read. */
const MOST = 12;

const middle = (engine: DateEngine, date: FuzzyDate): number => {
  const range = dateRange(engine, date);
  return (range.first + range.last) / 2;
};

/** How long a finished span lasted, in days; null while it is still going on. */
const lengthOf = (engine: DateEngine, span: Span): number | null => (span.to === null ? null : Math.max(0, middle(engine, span.to) - middle(engine, span.from)));

/** A length in the calendar's own years, with Earth's beside it when a year there is not much like a year here. */
function years(engine: DateEngine, days: number): string {
  const own = Math.round(days / engine.meanYear);
  const earth = Math.round(days / EARTH_YEAR);
  const text = `${groupDigits(own)} ${own === 1 ? 'year' : 'years'}`;
  return Math.abs(engine.meanYear - EARTH_YEAR) / EARTH_YEAR > 0.02 && own !== earth ? `${text} (${groupDigits(earth)} of Earth's)` : text;
}

/**
 * What stands out in a timeline, most telling first. Empty when nothing does, which is not the
 * same as the history being believable.
 */
export function reviewTimeline(timeline: Timeline, engine: DateEngine): Finding[] {
  const found: Finding[] = [];
  const extent = extentOf(timeline, engine);
  if (extent === null) return found;

  timeline.tracks.forEach((track, t) => {
    const finished = track.spans.map((span, index) => ({ span, index, days: lengthOf(engine, span) })).filter((one): one is { span: Span; index: number; days: number } => one.days !== null);

    if (track.kind === 'dynasty') {
      // A reign longer than any on record.
      for (const one of finished) {
        if (one.days / EARTH_YEAR > LONGEST_REIGN + 0.5) {
          found.push({
            id: 'long-reign',
            message: `${one.span.label} lasts ${years(engine, one.days)}. The longest reign on record is ${LONGEST_REIGN} years, and that king was crowned at four.`,
            refs: [{ kind: 'span', track: t, index: one.index }],
          });
        }
      }
      if (finished.length >= 4) {
        const lengths = finished.map((one) => one.days / EARTH_YEAR);
        const mean = lengths.reduce((sum, n) => sum + n, 0) / lengths.length;
        const refs: Ref[] = finished.map((one) => ({ kind: 'span', track: t, index: one.index }));
        // Reigns all of a length.
        if (mean > 0 && (Math.max(...lengths) - Math.min(...lengths)) / mean < 0.25) {
          found.push({
            id: 'even-reigns',
            message: `The reigns on ${track.name} all last about ${years(engine, mean * EARTH_YEAR)}. Real ones run from a few months to half a century: give the line one that is cut short and one that goes on too long.`,
            refs,
          });
        }
        // Reigns too long on average.
        if (mean > 35) {
          found.push({
            id: 'long-reigns',
            message: `The reigns on ${track.name} average ${years(engine, mean * EARTH_YEAR)}. Over a long run a hereditary crown changes hands every 20 to 25 years.`,
            refs,
          });
        }
      }
    }

    for (const one of finished) {
      const ref: Ref = { kind: 'span', track: t, index: one.index };
      const earth = one.days / EARTH_YEAR;
      // A war that runs for generations.
      // A label that already says it is an age of wars is not claiming to be one long war.
      if (/\bwar\b/i.test(one.span.label) && !/\b(era|age|period|wars|years)\b/i.test(one.span.label) && earth > 30) {
        found.push({
          id: 'long-war',
          message: `${one.span.label} lasts ${years(engine, one.days)}. A war that long is really several, with truces between them, as the Hundred Years' War was: consider an era with shorter wars inside it.`,
          refs: [ref],
        });
      }
      // Something vast, built in no time.
      if (/\b(cathedral|basilica|temple|palace|pyramid|great wall|canal)\b/i.test(one.span.label) && /\b(build|built|building|construction|raising|raised)\b/i.test(`${one.span.label} ${one.span.text}`) && earth < 10) {
        found.push({
          id: 'quick-building',
          message: `${one.span.label} takes ${years(engine, one.days)}. Salisbury Cathedral took 38 years, and that was thought fast; most took a century or more.`,
          refs: [ref],
        });
      }
    }
  });

  // Every span a round number of years.
  const round = timeline.tracks.flatMap((track, t) =>
    track.spans
      .map((span, index) => ({ span, ref: { kind: 'span', track: t, index } as Ref }))
      .filter(({ span }) => span.to !== null && precisionOf(span.from) === 'year' && precisionOf(span.to) === 'year' && !isUncertain(span.from) && !isUncertain(span.to)),
  );
  if (round.length >= 5 && round.every(({ span }) => (span.to!.year - span.from.year) % 5 === 0)) {
    found.push({ id: 'tidy-spans', message: 'Every span here lasts a multiple of five years. History is seldom that tidy: let a few of them end a year or two early.', refs: round.map((one) => one.ref) });
  }

  const events = timeline.tracks.flatMap((track, t) => track.events.map((event, index) => ({ event, ref: { kind: 'event', track: t, index } as Ref })));
  const spans = timeline.tracks.reduce((sum, track) => sum + track.spans.length, 0);

  // Old dates known to the day.
  const sharp = events.filter(({ event }) => precisionOf(event.date) === 'day' && !isUncertain(event.date) && (extent.last - dateRange(engine, event.date).first) / EARTH_YEAR > 1000);
  if (sharp.length > 0) {
    const oldest = sharp.reduce((a, b) => (dateRange(engine, a.event.date).first <= dateRange(engine, b.event.date).first ? a : b));
    found.push({
      id: 'sharp-past',
      message: `${oldest.event.title} is dated to the day, ${years(engine, extent.last - dateRange(engine, oldest.event.date).first)} before the latest thing here${sharp.length > 1 ? `, and ${sharp.length - 1} more like it` : ''}. Records that old seldom keep the day. If this one did, say why.`,
      refs: sharp.slice(0, 5).map((one) => one.ref),
    });
  }

  // A long past with no doubt in it.
  const dates: FuzzyDate[] = [
    ...events.map(({ event }) => event.date),
    ...timeline.tracks.flatMap((track) => track.spans.flatMap((span) => (span.to === null ? [span.from] : [span.from, span.to]))),
    ...timeline.eras.flatMap((era) => (era.to === null ? [era.from] : [era.from, era.to])),
  ];
  const reach = (extent.last - extent.first) / EARTH_YEAR;
  if (reach > 500 && dates.length >= 6 && !dates.some(isUncertain)) {
    found.push({
      id: 'no-doubt',
      message: `Nothing here is marked as uncertain, across ${years(engine, extent.last - extent.first)}. The further back, the vaguer the record: try "c." or a century for the earliest dates.`,
      refs: [],
    });
  }

  // Events with nothing slow under them.
  if (events.length >= 8 && spans === 0 && timeline.eras.length === 0) {
    found.push({ id: 'all-events', message: 'Everything here is an event. Add what lasted: a reign, a long peace, an age. Events need something slow underneath them.', refs: [] });
  }

  return found.slice(0, MOST);
}
