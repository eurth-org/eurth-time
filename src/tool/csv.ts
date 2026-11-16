/**
 * The timeline as CSV, and back: one row per era, span and event, for a spreadsheet. Dates are
 * there twice: in words, as the calendar writes them, and in Time's compact form, which sorts
 * and is what is read back first.
 */
import { describeTimeline, type DescribedItem } from './describe';
import { engineFor, type CalendarData, type DateEngine } from './engine';
import { decodeDate, encodeDate, formatDate, parseDate } from './fuzzy';
import { getItem, type Era, type Span, type TimeEvent, type Timeline } from './model';
import { normalizeTimeline, type Issue } from './normalize';

export const CSV_COLUMNS = ['type', 'track', 'title', 'from', 'to', 'from_code', 'to_code', 'duration', 'text', 'links', 'group'] as const;

/**
 * One cell. Quoted when it must be; and a text that a spreadsheet would run as a formula
 * (it starts with =, +, - or @) gets an apostrophe in front, so opening the file is safe.
 */
export function csvCell(value: string, guard = true): string {
  const text = guard && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The whole timeline as CSV text, with a header row and CRLF line ends as RFC 4180 asks. */
export function timelineCsv(timeline: Timeline, engine: DateEngine): string {
  const description = describeTimeline(timeline, engine);
  const lines: string[] = [CSV_COLUMNS.join(',')];
  const add = (track: string, item: DescribedItem, group = '') => {
    const source = getItem(timeline, item.ref) as Era | Span | TimeEvent;
    const from = 'date' in source ? source.date : source.from;
    const to = 'date' in source ? source.date : source.to;
    const fromWords = formatDate(engine, from);
    const toWords = to === null ? '' : formatDate(engine, to);
    lines.push(
      [
        csvCell(item.kind, false),
        csvCell(track),
        csvCell(item.title),
        csvCell(fromWords, false),
        csvCell(toWords, false),
        csvCell(encodeDate(from), false),
        csvCell(to === null ? '' : encodeDate(to), false),
        csvCell(item.duration, false),
        csvCell(item.text),
        csvCell(item.links.map((link) => link.url).join(' '), false),
        csvCell(group),
      ].join(','),
    );
  };
  for (const era of description.eras) add('', era);
  for (const track of description.tracks) for (const item of track.items) add(track.name, item, track.group);
  return `${lines.join('\r\n')}\r\n`;
}

/** The longest CSV text that will be read: far more than a timeline can hold. */
export const MAX_CSV_LENGTH = 2_000_000;

/** Reads CSV as RFC 4180 has it: quoted cells, doubled quotes, CRLF or LF line ends. Never throws. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === '') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell !== '' || row.length > 0) rows.push([...row, cell]);
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''));
}

/** The names a column may go by: the ones the export writes first, then what a person might type. */
const COLUMNS = {
  type: ['type', 'kind'],
  track: ['track'],
  title: ['title', 'label', 'name', 'event'],
  from: ['from', 'date', 'start'],
  to: ['to', 'end'],
  fromCode: ['from_code'],
  toCode: ['to_code'],
  text: ['text', 'description', 'notes'],
  links: ['links', 'link'],
  group: ['group'],
} as const;

/** Takes off the apostrophe the export puts before a text that a spreadsheet would run as a formula. */
const unguard = (value: string): string => (/^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value);

/**
 * A timeline from CSV: the columns the export writes, in any order, or a sheet typed by hand
 * with at least a title and a date. Each row is an era, a span or an event; rows are gathered
 * into tracks by the name in their track column. Dates are read from the compact code when it
 * is there, otherwise from the words, in the calendar given.
 *
 * A file is someone else's input: the result has been through normalizeTimeline, and `issues`
 * says what was put right or left out. Null when the text is not such a sheet at all.
 */
export function timelineFromCsv(text: unknown, calendar: CalendarData = null): { timeline: Timeline; issues: Issue[]; rows: number } | null {
  if (typeof text !== 'string' || text.length > MAX_CSV_LENGTH) return null;
  const rows = parseCsv(text);
  const header = rows[0]?.map((name) => name.trim().toLowerCase().replace(/\s+/g, '_'));
  if (header === undefined) return null;
  const column = (names: readonly string[]): number => header.findIndex((name) => names.includes(name));
  const at = Object.fromEntries(Object.entries(COLUMNS).map(([key, names]) => [key, column(names)])) as Record<keyof typeof COLUMNS, number>;
  if (at.title < 0 || (at.from < 0 && at.fromCode < 0)) return null;

  const engine = engineFor(calendar);
  /** A date for normalizeTimeline to check: the code if it reads as one, else the words, parsed. */
  const date = (code: string, words: string): unknown => (decodeDate(code) !== null ? code : (parseDate(engine, words) ?? null));
  const eras: unknown[] = [];
  const tracks = new Map<string, { name: string; group: string; spans: unknown[]; events: unknown[] }>();
  const body = rows.slice(1);
  for (const row of body) {
    const cell = (index: number): string => (index < 0 ? '' : (row[index] ?? '').trim());
    const from = date(cell(at.fromCode), cell(at.from));
    const hasEnd = cell(at.toCode) !== '' || cell(at.to) !== '';
    const to = hasEnd ? date(cell(at.toCode), cell(at.to)) : null;
    const named = cell(at.type).toLowerCase();
    // Without a type, a row with an end that differs from its start is a span.
    const kind = named === 'era' || named === 'span' || named === 'event' ? named : hasEnd && (cell(at.toCode) || cell(at.to)) !== (cell(at.fromCode) || cell(at.from)) ? 'span' : 'event';
    const title = unguard(cell(at.title));
    if (kind === 'era') {
      eras.push({ label: title, from, to });
      continue;
    }
    const name = unguard(cell(at.track)) || 'Imported';
    let track = tracks.get(name.toLowerCase());
    if (track === undefined) {
      track = { name, group: unguard(cell(at.group)), spans: [], events: [] };
      tracks.set(name.toLowerCase(), track);
    }
    const links = cell(at.links).split(/\s+/).filter((url) => url !== '');
    const words = unguard(cell(at.text));
    if (kind === 'span') track.spans.push({ label: title, from, to, text: words, links });
    else track.events.push({ title, date: from, text: words, links });
  }
  return { ...normalizeTimeline({ calendar, eras, tracks: [...tracks.values()] }), rows: body.length };
}
