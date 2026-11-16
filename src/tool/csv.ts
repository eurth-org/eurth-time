/**
 * The timeline as CSV: one row per era, span and event, for a spreadsheet. Dates are there
 * twice: in words, as the calendar writes them, and in Time's compact form, which sorts and
 * can be read back.
 */
import { describeTimeline, type DescribedItem } from './describe';
import type { DateEngine } from './engine';
import { encodeDate, formatDate } from './fuzzy';
import { getItem, type Era, type Span, type TimeEvent, type Timeline } from './model';

export const CSV_COLUMNS = ['type', 'track', 'title', 'from', 'to', 'from_code', 'to_code', 'duration', 'text', 'links'] as const;

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
  const add = (track: string, item: DescribedItem) => {
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
      ].join(','),
    );
  };
  for (const era of description.eras) add('', era);
  for (const track of description.tracks) for (const item of track.items) add(track.name, item);
  return `${lines.join('\r\n')}\r\n`;
}
