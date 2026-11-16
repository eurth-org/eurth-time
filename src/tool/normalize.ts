/**
 * Whatever arrives from a link or a file is someone else's input. normalizeTimeline takes
 * anything at all and gives back a timeline that is safe to use: every text cut to length, every
 * list cut to size, every date made to fit the calendar, every link https. It never throws, and
 * it says what it had to change.
 */
import { canConvert, cleanCalendar, engineFor, sameCalendar, type CalendarData, type DateEngine } from './engine';
import { cleanDate, dateRange, type FuzzyDate } from './fuzzy';
import { LIMITS, TIMELINE_VERSION, TRACK_KINDS, type Era, type Link, type Span, type TimeEvent, type Timeline, type Track, type TrackKind } from './model';

/** Something that had to be put right, in words for the person. */
export interface Issue {
  /** Where: "tracks[0].events[2].date". */
  path: string;
  message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const CONTROL = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`, 'g');

/** Plain text of at most `max` characters: no control characters, no runs of spaces. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return Array.from(value.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim()).slice(0, max).join('').trim();
}

/** An https address, or null. */
export function cleanUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > LIMITS.url || !/^https:\/\/[!-~]+$/.test(value)) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

function cleanLinks(value: unknown, path: string, issues: Issue[]): Link[] {
  if (!Array.isArray(value)) return [];
  const links: Link[] = [];
  value.slice(0, LIMITS.links + 4).forEach((item, i) => {
    const url = cleanUrl(isRecord(item) ? item.url : item);
    if (url === null) {
      issues.push({ path: `${path}[${i}]`, message: 'A link was left out: links must start with https://.' });
      return;
    }
    if (links.length >= LIMITS.links) return;
    const label = cleanText(isRecord(item) ? item.label : '', LIMITS.linkLabel);
    links.push({ label: label === '' ? new URL(url).hostname.replace(/^www\./, '') : label, url });
  });
  if (value.length > LIMITS.links) issues.push({ path, message: `A card holds at most ${LIMITS.links} links; the rest were left out.` });
  return links;
}

function readDate(engine: DateEngine, value: unknown, path: string, issues: Issue[]): FuzzyDate | null {
  const cleaned = cleanDate(engine, value);
  if (cleaned === null) return null;
  if (cleaned.changed) issues.push({ path, message: 'A date did not fit the calendar and was moved to the nearest one that does.' });
  return cleaned.date;
}

/** From and to, in order. A missing or unreadable end means "still going on". */
function readStretch(
  engine: DateEngine,
  item: Record<string, unknown>,
  path: string,
  issues: Issue[],
): { from: FuzzyDate; to: FuzzyDate | null } | null {
  const from = readDate(engine, item.from, `${path}.from`, issues);
  if (from === null) return null;
  let to: FuzzyDate | null = null;
  if (item.to !== null && item.to !== undefined) {
    to = readDate(engine, item.to, `${path}.to`, issues);
    if (to === null) issues.push({ path: `${path}.to`, message: 'An end date could not be read, so it was left open.' });
  }
  if (to !== null && dateRange(engine, to).last < dateRange(engine, from).first) {
    issues.push({ path, message: 'An end date came before its start, so the two were swapped.' });
    return { from: to, to: from };
  }
  return { from, to };
}

function readCalendar(value: unknown, issues: Issue[]): CalendarData {
  if (value === null || value === undefined) return null;
  let copy: CalendarData = null;
  try {
    // A calendar that cannot be written as JSON, or is absurdly long, is no calendar.
    if (JSON.stringify(value).length <= LIMITS.calendar) copy = cleanCalendar(value);
  } catch {
    copy = null;
  }
  if (copy === null) issues.push({ path: 'calendar', message: 'The calendar could not be read, so the dates are shown in the Gregorian calendar.' });
  return copy;
}

/** A second calendar is kept only when it is a different one and both are tied to Earth: otherwise there is no reading one in the other. */
function readAlso(value: unknown, calendar: CalendarData, issues: Issue[]): CalendarData {
  if (value === null || value === undefined) return null;
  let copy: CalendarData = null;
  try {
    if (JSON.stringify(value).length <= LIMITS.calendar) copy = cleanCalendar(value);
  } catch {
    copy = null;
  }
  if (copy === null || sameCalendar(copy, calendar) || !canConvert(engineFor(calendar), engineFor(copy))) {
    issues.push({ path: 'also', message: "The second calendar was left out: it must differ from the timeline's own, and both need a link to Earth's calendar." });
    return null;
  }
  return copy;
}

/**
 * A clean timeline from anything. `issues` lists what was changed or left out; it is empty for
 * a timeline that was already clean, and a clean timeline comes back equal to what went in.
 */
export function normalizeTimeline(input: unknown): { timeline: Timeline; issues: Issue[] } {
  const issues: Issue[] = [];
  const source = isRecord(input) ? input : {};
  if (!isRecord(input)) issues.push({ path: '', message: 'This is not a timeline, so an empty one was started.' });
  const calendar = readCalendar(source.calendar, issues);
  const also = readAlso(source.also, calendar, issues);
  const engine = engineFor(calendar);

  const eras: Era[] = [];
  const eraList = Array.isArray(source.eras) ? source.eras : [];
  eraList.slice(0, LIMITS.eras).forEach((item, i) => {
    const path = `eras[${i}]`;
    const stretch = isRecord(item) ? readStretch(engine, item, path, issues) : null;
    if (!isRecord(item) || stretch === null) {
      issues.push({ path, message: 'An era had no start date that could be read, so it was left out.' });
      return;
    }
    eras.push({ label: cleanText(item.label, LIMITS.label) || 'Era', ...stretch });
  });
  if (eraList.length > LIMITS.eras) issues.push({ path: 'eras', message: `A timeline holds at most ${LIMITS.eras} eras; the rest were left out.` });

  const tracks: Track[] = [];
  const trackList = Array.isArray(source.tracks) ? source.tracks : [];
  let room: number = LIMITS.items;
  let overfull = false;
  trackList.slice(0, LIMITS.tracks).forEach((item, t) => {
    if (!isRecord(item)) {
      issues.push({ path: `tracks[${t}]`, message: 'A track could not be read and was left out.' });
      return;
    }
    const spans: Span[] = [];
    const spanList = Array.isArray(item.spans) ? item.spans : [];
    spanList.forEach((raw, i) => {
      const path = `tracks[${t}].spans[${i}]`;
      const stretch = isRecord(raw) ? readStretch(engine, raw, path, issues) : null;
      if (!isRecord(raw) || stretch === null) {
        issues.push({ path, message: 'A span had no start date that could be read, so it was left out.' });
        return;
      }
      if (spans.length >= LIMITS.spans || room <= 0) {
        overfull = true;
        return;
      }
      room--;
      const tone = typeof raw.tone === 'number' && Number.isInteger(raw.tone) && raw.tone >= 0 && raw.tone < LIMITS.tones ? raw.tone : spans.length % LIMITS.tones;
      spans.push({
        label: cleanText(raw.label, LIMITS.label) || 'Untitled span',
        ...stretch,
        text: cleanText(raw.text, LIMITS.text),
        links: cleanLinks(raw.links, `${path}.links`, issues),
        tone,
      });
    });
    const events: TimeEvent[] = [];
    const eventList = Array.isArray(item.events) ? item.events : [];
    eventList.forEach((raw, i) => {
      const path = `tracks[${t}].events[${i}]`;
      const date = isRecord(raw) ? readDate(engine, raw.date, `${path}.date`, issues) : null;
      if (!isRecord(raw) || date === null) {
        issues.push({ path, message: 'An event had no date that could be read, so it was left out.' });
        return;
      }
      if (events.length >= LIMITS.events || room <= 0) {
        overfull = true;
        return;
      }
      room--;
      events.push({
        title: cleanText(raw.title, LIMITS.label) || 'Untitled event',
        date,
        text: cleanText(raw.text, LIMITS.text),
        links: cleanLinks(raw.links, `${path}.links`, issues),
      });
    });
    const kind = TRACK_KINDS.includes(item.kind as TrackKind) ? (item.kind as TrackKind) : 'nation';
    tracks.push({ name: cleanText(item.name, LIMITS.name) || `Track ${tracks.length + 1}`, kind, spans, events });
  });
  if (trackList.length > LIMITS.tracks) issues.push({ path: 'tracks', message: `A timeline holds at most ${LIMITS.tracks} tracks; the rest were left out.` });
  if (overfull) {
    issues.push({
      path: 'tracks',
      message: `A track holds at most ${LIMITS.spans} spans and ${LIMITS.events} events, and a timeline ${LIMITS.items} in all; the rest were left out.`,
    });
  }

  return { timeline: { v: TIMELINE_VERSION, title: cleanText(source.title, LIMITS.title), calendar, also, eras, tracks }, issues };
}
