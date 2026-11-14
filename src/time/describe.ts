/**
 * The whole timeline in words.
 *
 * One source for three readers: the text version on the page (for screen readers, and for
 * search engines), "Copy description", and the description inside an exported picture. Every
 * span and event is here with its date, its track and its text, in the order things happened,
 * so nothing depends on seeing the chart.
 */
import { groupDigits, yearOf } from './dates';
import type { DateEngine } from './engine';
import { dateRange, formatDate, isUncertain, precisionOf, type FuzzyDate } from './fuzzy';
import { extentOf } from './layout';
import { countItems, type Era, type Link, type Ref, type Span, type TimeEvent, type Timeline, type TrackKind } from './model';

/** One era, span or event, in words. */
export interface DescribedItem {
  ref: Ref;
  kind: 'era' | 'span' | 'event';
  /** When: "18 March 1869 CE", "1622 to 1870 CE", "since 1871 CE". */
  when: string;
  title: string;
  /** How long a span or era lasted: "248 years", "about 6 years". Empty for an event or an open end. */
  duration: string;
  text: string;
  links: Link[];
  /** The first day it covers, for sorting. */
  first: number;
}

export interface DescribedTrack {
  index: number;
  name: string;
  kind: TrackKind;
  /** Its spans and events together, earliest first. */
  items: DescribedItem[];
}

export interface Description {
  /** The timeline's title, or "Untitled timeline". */
  title: string;
  /** One sentence about the whole. */
  summary: string;
  eras: DescribedItem[];
  tracks: DescribedTrack[];
}

const plural = (n: number, one: string, many = `${one}s`): string => `${groupDigits(n)} ${n === 1 ? one : many}`;

const list = (parts: string[]): string =>
  parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]!}`;

/** A length of time in the calendar's own years, months and days: "248 years", "4 months", "16 days". */
export function formatDuration(engine: DateEngine, days: number): string {
  const length = Math.max(0, days);
  const years = length / engine.meanYear;
  const month = engine.meanYear / engine.months.length;
  if (years >= 1e9) return `${Math.round(years / 1e7) / 100} billion years`;
  if (years >= 1e6) return `${Math.round(years / 1e4) / 100} million years`;
  if (years >= 1.5) return plural(Math.round(years), 'year');
  if (years >= 0.96) return '1 year';
  if (length >= 2 * month) return plural(Math.round(length / month), 'month');
  return plural(Math.round(length), 'day');
}

/** The middle of the stretch a date covers. */
const middle = (engine: DateEngine, date: FuzzyDate): number => {
  const range = dateRange(engine, date);
  return (range.first + range.last) / 2;
};

/**
 * From one date to another, in words: "1622 to 1870 CE", "3 Mistmoon 351 FS to 19 Thawmoon 352 FS",
 * "since 1871 CE" for an open end.
 */
export function formatStretch(engine: DateEngine, from: FuzzyDate, to: FuzzyDate | null): string {
  if (to === null) return `since ${formatDate(engine, from)}`;
  const a = formatDate(engine, from);
  const b = formatDate(engine, to);
  if (a === b) return a;
  // Two plain years on the same side of year 1 share their era: "1622 to 1870 CE".
  const plainYear = (date: FuzzyDate) => precisionOf(date) === 'year' && !isUncertain(date);
  const label = from.year < 1 && engine.eraBefore !== '' ? engine.eraBefore : engine.era;
  if (plainYear(from) && plainYear(to) && label !== '' && from.year >= 1 === to.year >= 1 && a.endsWith(` ${label}`)) {
    return `${a.slice(0, -label.length - 1)} to ${b}`;
  }
  return `${a} to ${b}`;
}

/** How long a stretch lasted, from the middle of its first date to the middle of its last. Empty for an open end. */
export function stretchDuration(engine: DateEngine, from: FuzzyDate, to: FuzzyDate | null): string {
  if (to === null) return '';
  const exact = precisionOf(from) === 'day' && precisionOf(to) === 'day';
  const days = exact ? dateRange(engine, to).first - dateRange(engine, from).first : middle(engine, to) - middle(engine, from);
  const text = formatDuration(engine, days);
  return isUncertain(from) || isUncertain(to) ? `about ${text}` : text;
}

function describeStretch(engine: DateEngine, ref: Ref, item: Era | Span): DescribedItem {
  return {
    ref,
    kind: ref.kind,
    when: formatStretch(engine, item.from, item.to),
    title: item.label,
    duration: stretchDuration(engine, item.from, item.to),
    text: 'text' in item ? item.text : '',
    links: 'links' in item ? item.links : [],
    first: dateRange(engine, item.from).first,
  };
}

function describeEvent(engine: DateEngine, ref: Ref, event: TimeEvent): DescribedItem {
  return { ref, kind: 'event', when: formatDate(engine, event.date), title: event.title, duration: '', text: event.text, links: event.links, first: dateRange(engine, event.date).first };
}

/** One era, span or event in words, for its card. Null when there is no such thing. */
export function describeItem(timeline: Timeline, engine: DateEngine, ref: Ref): DescribedItem | null {
  if (ref.kind === 'era') {
    const era = timeline.eras[ref.index];
    return era === undefined ? null : describeStretch(engine, ref, era);
  }
  const track = timeline.tracks[ref.track];
  if (track === undefined) return null;
  if (ref.kind === 'span') {
    const span = track.spans[ref.index];
    return span === undefined ? null : describeStretch(engine, ref, span);
  }
  const event = track.events[ref.index];
  return event === undefined ? null : describeEvent(engine, ref, event);
}

/** "4 tracks, 5 spans, 13 events and 3 eras", leaving out what there is none of. */
export function countLine(timeline: Timeline): string {
  const count = countItems(timeline);
  const parts = [
    count.tracks > 0 ? plural(count.tracks, 'track') : '',
    count.spans > 0 ? plural(count.spans, 'span') : '',
    count.events > 0 ? plural(count.events, 'event') : '',
    count.eras > 0 ? plural(count.eras, 'era') : '',
  ].filter((part) => part !== '');
  return list(parts);
}

/** The whole timeline, described. */
export function describeTimeline(timeline: Timeline, engine: DateEngine): Description {
  const title = timeline.title === '' ? 'Untitled timeline' : timeline.title;
  const extent = extentOf(timeline, engine);
  const calendar = engine.name === '' ? 'its own calendar' : /^the /i.test(engine.name) ? engine.name : `the ${engine.name}`;
  let summary: string;
  if (extent === null) {
    summary = timeline.tracks.length === 0 ? 'An empty timeline.' : `A timeline with ${plural(timeline.tracks.length, 'track')} and nothing on ${timeline.tracks.length === 1 ? 'it' : 'them'} yet.`;
  } else {
    const first = formatDate(engine, { year: yearOf(engine, extent.first) });
    const last = formatDate(engine, { year: yearOf(engine, extent.last) });
    const span = first === last ? `in ${first}` : `from ${first} to ${last}`;
    summary = `A timeline ${span}, dated in ${calendar}, with ${countLine(timeline)}.`;
  }

  const byDate = (a: DescribedItem, b: DescribedItem) => a.first - b.first || (a.kind === b.kind ? a.ref.index - b.ref.index : a.kind === 'span' ? -1 : 1);
  return {
    title,
    summary,
    eras: timeline.eras.map((era, index) => describeStretch(engine, { kind: 'era', index }, era)).sort(byDate),
    tracks: timeline.tracks.map((track, t) => ({
      index: t,
      name: track.name,
      kind: track.kind,
      items: [
        ...track.spans.map((span, index) => describeStretch(engine, { kind: 'span', track: t, index }, span)),
        ...track.events.map((event, index) => describeEvent(engine, { kind: 'event', track: t, index }, event)),
      ].sort(byDate),
    })),
  };
}

/** One item as a line: "1622 to 1870 CE: House Delmaris (248 years). Merchant-princes who…" */
export function itemLine(item: DescribedItem): string {
  const head = `${item.when}: ${item.title}${item.duration === '' ? '' : ` (${item.duration})`}`;
  if (item.text === '') return head;
  return `${head}${/[.!?…]$/.test(head) ? '' : '.'} ${item.text}`;
}

/** The whole description as plain text, for "Copy description". */
export function descriptionText(description: Description): string {
  const lines: string[] = [description.title, description.summary];
  if (description.eras.length > 0) {
    lines.push('', 'Eras');
    for (const era of description.eras) lines.push(`- ${itemLine(era)}`);
  }
  for (const track of description.tracks) {
    lines.push('', track.name);
    if (track.items.length === 0) lines.push('- Nothing yet.');
    for (const item of track.items) lines.push(`- ${itemLine(item)}`);
  }
  return lines.join('\n');
}
