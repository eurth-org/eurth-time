/**
 * Dates as people give them in a history: to the day, to the month, to the year, "c. 1650",
 * "the 1650s", "the 17th century". Each one covers a stretch of days, from a first day to a last,
 * and can be written back the way it was meant.
 */
import type { DateEngine, YearPart } from './engine';
import { BIG_BANG_DAYS, MAX_YEAR, countsBack, formatYear, groupDigits, inRange, ordinal, partsOf, yearEnd, yearNumber, yearOf, yearStart } from './dates';

/** A date, as exact or as loose as it is known. Plain JSON. */
export interface FuzzyDate {
  /** The year: 1 is the first year, 0 the year before it, -1 the one before that. For a decade or century, its first year. */
  year: number;
  /** The month (1-based), when known. */
  month?: number;
  /** The block of days outside the months (1-based), instead of a month. */
  intercalary?: number;
  /** The day of the month or of the block, when known. */
  day?: number;
  /** "c. 1650": about then. */
  circa?: true;
  /** "1650s" or "17th century": some time in that stretch. */
  span?: 'decade' | 'century';
}

export type Precision = 'day' | 'month' | 'year' | 'decade' | 'century';

/** How finely a date is given. */
export function precisionOf(date: FuzzyDate): Precision {
  if (date.span !== undefined) return date.span;
  if (date.month === undefined && date.intercalary === undefined) return 'year';
  return date.day === undefined ? 'month' : 'day';
}

/** Whether the date is marked as loose: "c.", a decade or a century. */
export const isUncertain = (date: FuzzyDate): boolean => date.circa === true || date.span !== undefined;

/** The first and last year a date covers. One and the same unless it is a decade or a century. */
export function spanYears(engine: DateEngine, date: FuzzyDate): [number, number] {
  if (date.span === undefined) return [date.year, date.year];
  const back = countsBack(engine);
  const before = date.year < 1 && back;
  const n = yearNumber(engine, date.year);
  let low: number;
  let high: number;
  if (date.span === 'decade') {
    low = Math.floor(n / 10) * 10;
    high = low + 9;
  } else {
    high = Math.ceil(n / 100) * 100 || 0;
    low = high - 99;
  }
  // In a calendar that counts backwards there is no year numbered 0 on either side.
  if (back) low = Math.max(low, 1);
  return before ? [1 - high, 1 - low] : [low, high];
}

function partOf(engine: DateEngine, date: FuzzyDate): YearPart | null {
  if (date.month === undefined && date.intercalary === undefined) return null;
  const kind = date.month !== undefined ? 'month' : 'intercalary';
  const index = date.month ?? date.intercalary;
  return partsOf(engine, date.year).find((part) => part.kind === kind && part.index === index) ?? null;
}

/** The first and last day number a date covers. */
export function dateRange(engine: DateEngine, date: FuzzyDate): { first: number; last: number } {
  const [from, to] = spanYears(engine, date);
  const part = date.span === undefined ? partOf(engine, date) : null;
  if (part === null) return { first: yearStart(engine, from), last: yearEnd(engine, to) };
  if (date.day === undefined) return { first: part.start, last: part.start + Math.max(part.days, 1) - 1 };
  const day = part.start + Math.min(date.day, Math.max(part.days, 1)) - 1;
  return { first: day, last: day };
}

/** Earlier dates first; of two that start together, the shorter first. */
export function compareDates(engine: DateEngine, a: FuzzyDate, b: FuzzyDate): number {
  const x = dateRange(engine, a);
  const y = dateRange(engine, b);
  return x.first - y.first || x.last - y.last;
}

/** Whether a date lies wholly before the Big Bang. */
export const isBeforeBigBang = (engine: DateEngine, date: FuzzyDate): boolean => dateRange(engine, date).last < -BIG_BANG_DAYS;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const whole = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) ? value : null);

/**
 * A date from anywhere, made to fit the calendar. Takes the object or the compact text
 * (see encodeDate). A month that does not exist is dropped, a day past the end of its month
 * becomes the last day, a decade is moved to its first year. `changed` says whether anything
 * had to give. Null when there is no usable year.
 */
export function cleanDate(engine: DateEngine, input: unknown): { date: FuzzyDate; changed: boolean } | null {
  const raw = typeof input === 'string' ? decodeDate(input) : input;
  if (!isRecord(raw)) return null;
  const year = whole(raw.year);
  if (year === null || year < -MAX_YEAR || year > MAX_YEAR) return null;
  const date: FuzzyDate = { year };
  let changed = false;

  if (raw.span === 'decade' || raw.span === 'century') {
    date.span = raw.span;
    date.year = spanYears(engine, date)[0];
    changed = date.year !== year || raw.month !== undefined || raw.intercalary !== undefined || raw.day !== undefined;
  } else if (raw.month !== undefined || raw.intercalary !== undefined) {
    const kind = raw.month !== undefined ? 'month' : 'intercalary';
    const index = whole(kind === 'month' ? raw.month : raw.intercalary);
    const part = index === null ? undefined : partsOf(engine, year).find((p) => p.kind === kind && p.index === index);
    if (part === undefined || part.days < 1) {
      changed = true;
    } else {
      date[kind] = part.index;
      if (raw.day !== undefined) {
        const day = whole(raw.day);
        if (day === null || day < 1) changed = true;
        else {
          date.day = Math.min(day, part.days);
          changed = date.day !== day;
        }
      }
    }
    if (raw.month !== undefined && raw.intercalary !== undefined) changed = true;
  } else if (raw.day !== undefined) {
    changed = true;
  }
  if (raw.circa === true) date.circa = true;
  return { date, changed };
}

/** Whether a date exists in the calendar exactly as given. 30 February does not. */
export function isValidDate(engine: DateEngine, date: FuzzyDate): boolean {
  const cleaned = cleanDate(engine, date);
  return cleaned !== null && !cleaned.changed;
}

/**
 * A date written out: "17 Harvestmoon 1022 FS", "Harvestmoon 1022 FS", "1022 FS", "c. 1650 FS",
 * "1650s FS", "17th century FS", "Midyear Day 1020 FS". The short style uses short month names.
 */
export function formatDate(engine: DateEngine, date: FuzzyDate, style: 'long' | 'short' = 'long'): string {
  const circa = date.circa === true ? 'c. ' : '';
  if (date.span !== undefined) {
    const [low, high] = spanYears(engine, date);
    const n = yearNumber(engine, date.year);
    // A calendar that runs through zero has no "0th century": say which years instead.
    if (n < 1 && date.span === 'century') return `${circa}${formatYear(engine, low)} to ${formatYear(engine, high)}`;
    const label = date.year < 1 && countsBack(engine) ? engine.eraBefore : engine.era;
    const core = date.span === 'decade' ? `${groupDigits(Math.floor(n / 10) * 10)}s` : `${ordinal(Math.ceil(n / 100))} century`;
    return `${circa}${core}${label === '' ? '' : ` ${label}`}`;
  }
  const year = formatYear(engine, date.year);
  if (date.month !== undefined) {
    const month = engine.months[date.month - 1];
    const name = month === undefined ? '' : style === 'short' ? month.short : month.name;
    return `${circa}${date.day === undefined ? '' : `${date.day} `}${name} ${year}`;
  }
  if (date.intercalary !== undefined) {
    const block = engine.intercalary[date.intercalary - 1];
    const name = block?.name ?? '';
    return `${circa}${date.day === undefined || block?.single ? '' : `${date.day} `}${name} ${year}`;
  }
  return `${circa}${year}`;
}

/**
 * A date as compact text, for links and files: "1022" for a year, "1022-9" for a month,
 * "1022-9-17" for a day, "1020-i1-1" for a day outside the months, "1650D" for a decade,
 * "1601C" for a century, with "~" in front for "about". Years are plain numbers: 0 is the year
 * before year 1.
 */
export function encodeDate(date: FuzzyDate): string {
  const circa = date.circa === true ? '~' : '';
  if (date.span !== undefined) return `${circa}${date.year}${date.span === 'decade' ? 'D' : 'C'}`;
  const part = date.month !== undefined ? `-${date.month}` : date.intercalary !== undefined ? `-i${date.intercalary}` : '';
  return `${circa}${date.year}${part}${part !== '' && date.day !== undefined ? `-${date.day}` : ''}`;
}

/** Reads the text encodeDate writes. Null for anything else. The date is not checked against a calendar. */
export function decodeDate(text: unknown): FuzzyDate | null {
  if (typeof text !== 'string') return null;
  const found = /^(~?)(-?\d{1,11})(?:([DC])|-(i?)(\d{1,3})(?:-(\d{1,4}))?)?$/.exec(text);
  if (!found) return null;
  const date: FuzzyDate = { year: Number(found[2]) || 0 };
  if (found[3] !== undefined) date.span = found[3] === 'D' ? 'decade' : 'century';
  else if (found[5] !== undefined) {
    if (found[4] === 'i') date.intercalary = Number(found[5]);
    else date.month = Number(found[5]);
    if (found[6] !== undefined) date.day = Number(found[6]);
  }
  if (found[1] === '~') date.circa = true;
  return date;
}

const fold = (text: string): string => text.toLocaleLowerCase('en').replace(/\s+/g, ' ').trim();

/** Other ways people write an era label. */
const ALIASES: Record<string, string[]> = { bce: ['bc'], ce: ['ad'] };

const labelsOf = (label: string): string[] => (label === '' ? [] : [fold(label), ...(ALIASES[fold(label)] ?? [])]);

/** The month or block a name means: its full name, its short form, or the start of one name only. */
function findPart(engine: DateEngine, name: string): { month: number } | { intercalary: number } | null {
  const key = fold(name);
  if (key === '') return null;
  const month = engine.months.findIndex((m) => fold(m.name) === key);
  if (month >= 0) return { month: month + 1 };
  const block = engine.intercalary.findIndex((b) => fold(b.name) === key);
  if (block >= 0) return { intercalary: block + 1 };
  const short = engine.months.findIndex((m) => fold(m.short) === key);
  if (short >= 0) return { month: short + 1 };
  if (Array.from(key).length < 3) return null;
  const starts = [
    ...engine.months.map((m, i) => ({ name: m.name, part: { month: i + 1 } })),
    ...engine.intercalary.map((b, i) => ({ name: b.name, part: { intercalary: i + 1 } })),
  ].filter((candidate) => fold(candidate.name).startsWith(key));
  return starts.length === 1 ? starts[0]!.part : null;
}

const NUMBER = /^-?\d{1,3}(?:,\d{3})+$|^-?\d{1,11}$/;
const toNumber = (text: string): number | null => (NUMBER.test(text) ? Number(text.replace(/,/g, '')) : null);

/**
 * Reads a date as a person types it. Understands everything formatDate writes, and more:
 *
 *   1650            1650 FS          3 Before the Founding      -200 (200 years before year 1)
 *   c. 1650         circa 1650       about 1650                 ~1650
 *   1650s           17th century     3rd century BCE            1601 to 1700
 *   Harvestmoon 1022                 17 Harvestmoon 1022 FS     17th of Har, 1022
 *   Midyear Day 1020                 1022-09-17                 1022-09
 *
 * Month names may be shortened as far as they stay unique. Null for text that is not a date,
 * and for a date that does not exist in the calendar (30 February).
 */
export function parseDate(engine: DateEngine, input: string): FuzzyDate | null {
  if (typeof input !== 'string' || input.length > 200) return null;
  let text = input.normalize('NFKC').replace(/[\u2212\u2012\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
  if (text === '') return null;

  let circa = false;
  const about = /^(?:circa\s+|about\s+|around\s+|ca?\.\s*|ca?\s+(?=[\d-])|~\s*)/i.exec(text);
  if (about) {
    circa = true;
    text = text.slice(about[0].length);
  }

  const finish = (date: FuzzyDate): FuzzyDate | null => {
    const cleaned = cleanDate(engine, date);
    if (cleaned === null || cleaned.changed) return null;
    if (circa) cleaned.date.circa = true;
    return cleaned.date;
  };

  // "−99 KY to 0 KY": a decade or a century written as its first and last year.
  const fromTo = /^(.+?) to (.+)$/i.exec(text);
  if (fromTo) {
    const first = parseDate(engine, fromTo[1]!);
    const last = parseDate(engine, fromTo[2]!);
    if (first === null || last === null || precisionOf(first) !== 'year' || precisionOf(last) !== 'year') return null;
    for (const span of ['decade', 'century'] as const) {
      const [low, high] = spanYears(engine, { year: first.year, span });
      if (low === first.year && high === last.year) return finish({ year: low, span });
    }
    return null;
  }

  // The compact form, as cal.eurth.org writes it: years as plain numbers.
  const compact = /^(-?\d{1,11})-(i?)(\d{1,3})(?:-(\d{1,4}))?$/i.exec(text);
  if (compact) {
    const date: FuzzyDate = { year: Number(compact[1]) || 0 };
    if (compact[2] !== '') date.intercalary = Number(compact[3]);
    else date.month = Number(compact[3]);
    if (compact[4] !== undefined) date.day = Number(compact[4]);
    return finish(date);
  }

  // The era label, after the year or in front of it ("AD 1066").
  let side: 'before' | 'after' | null = null;
  const lower = fold(text);
  const sides: ['before' | 'after', string[]][] = [
    ['before', labelsOf(engine.eraBefore)],
    ['after', labelsOf(engine.era)],
  ];
  search: for (const [name, labels] of sides) {
    for (const label of labels) {
      if (lower.endsWith(label) && /[\s\d]$/.test(lower.slice(0, -label.length))) {
        side = name;
        text = text.slice(0, text.length - label.length).trim();
        break search;
      }
      if (lower.startsWith(`${label} `)) {
        side = name;
        text = text.slice(label.length).trim();
        break search;
      }
    }
  }

  const back = countsBack(engine);
  /** The year a written number means, or null when there is no such year. */
  const yearFrom = (n: number): number | null => {
    if (side === 'before') return n >= 1 ? 1 - n : null;
    if (side === 'after') return n >= (back ? 1 : -MAX_YEAR) ? n : null;
    if (!back) return n;
    if (n === 0) return null;
    return n < 0 ? 1 + n : n;
  };

  const decade = /^(-?[\d,]+)s$/i.exec(text);
  if (decade) {
    const n = toNumber(decade[1]!);
    if (n === null) return null;
    // "0s" is the years 1 to 9.
    const year = yearFrom(n === 0 && back ? 1 : n);
    return year === null ? null : finish({ year: spanYears(engine, { year, span: 'decade' })[0], span: 'decade' });
  }

  const century = /^(\d{1,9})(?:st|nd|rd|th)?\s+century$/i.exec(text);
  if (century) {
    const n = Number(century[1]);
    const year = n < 1 ? null : yearFrom(n * 100);
    return year === null ? null : finish({ year: spanYears(engine, { year, span: 'century' })[0], span: 'century' });
  }

  const bare = toNumber(text);
  if (bare !== null) {
    const year = yearFrom(bare);
    return year === null ? null : finish({ year });
  }

  const named = /^(?:(\d{1,4})(?:st|nd|rd|th)?\s+(?:of\s+)?)?(.+?),?\s+(-?[\d,]+)$/i.exec(text);
  if (!named) return null;
  const n = toNumber(named[3]!);
  const part = findPart(engine, named[2]!);
  if (n === null || part === null) return null;
  const year = yearFrom(n);
  if (year === null) return null;
  const date: FuzzyDate = { year, ...part };
  if (named[1] !== undefined) date.day = Number(named[1]);
  else if ('intercalary' in part && engine.intercalary[part.intercalary - 1]?.single) date.day = 1;
  return finish(date);
}

/**
 * The date of a day number, as finely as asked: the day, its month or its year. Beyond the
 * years the engine counts day by day there are only years.
 */
export function dateOfDay(engine: DateEngine, days: number, precision: 'day' | 'month' | 'year' = 'day'): FuzzyDate {
  const year = yearOf(engine, days);
  if (precision === 'year' || !inRange(engine, year)) return { year };
  const whole = Math.floor(days);
  const part = partsOf(engine, year).find((p) => p.days > 0 && whole >= p.start && whole < p.start + p.days);
  if (part === undefined) return { year };
  const date: FuzzyDate = { year, [part.kind]: part.index };
  if (precision === 'day' || (part.kind === 'intercalary' && engine.intercalary[part.index - 1]?.single)) date.day = whole - part.start + 1;
  return date;
}
