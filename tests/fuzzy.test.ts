import { describe, expect, it } from 'vitest';
import { MAX_YEAR, partsOf, yearEnd, yearStart } from '../src/time/dates';
import { cleanDate, compareDates, dateRange, decodeDate, encodeDate, formatDate, isBeforeBigBang, isUncertain, isValidDate, parseDate, precisionOf, spanYears, type FuzzyDate } from '../src/time/fuzzy';
import { ENGINES, between, gregorian, kharan, meridian, random, selunnan } from './helpers/engines';

describe('what a date covers', () => {
  it('a day, a month, a year', () => {
    expect(dateRange(selunnan, { year: 1022, month: 9, day: 17 })).toEqual({ first: 372_088, last: 372_088 });
    expect(dateRange(selunnan, { year: 1022, month: 9 })).toEqual({ first: 372_072, last: 372_099 });
    expect(dateRange(selunnan, { year: 1022 })).toEqual({ first: yearStart(selunnan, 1022), last: yearStart(selunnan, 1023) - 1 });
    expect(dateRange(gregorian, { year: 2024, month: 2 }).last - dateRange(gregorian, { year: 2024, month: 2 }).first).toBe(28);
    expect(dateRange(gregorian, { year: 1, month: 1, day: 1 })).toEqual({ first: 0, last: 0 });
  });

  it('days outside the months', () => {
    const midyear = dateRange(selunnan, { year: 1020, intercalary: 1, day: 1 });
    expect(midyear.first).toBe(midyear.last);
    expect(midyear.first).toBe(yearStart(selunnan, 1020) + 7 * 28);
    const festival = dateRange(meridian, { year: 4, intercalary: 1 });
    expect(festival.last - festival.first).toBe(5);
    expect(dateRange(kharan, { year: 7, intercalary: 1, day: 1 }).first).toBe(yearStart(kharan, 7));
    expect(dateRange(kharan, { year: 7, intercalary: 2, day: 1 }).first).toBe(yearEnd(kharan, 7));
  });

  it('decades and centuries after year 1', () => {
    expect(spanYears(gregorian, { year: 1650, span: 'decade' })).toEqual([1650, 1659]);
    expect(spanYears(gregorian, { year: 1657, span: 'decade' })).toEqual([1650, 1659]);
    expect(spanYears(gregorian, { year: 1601, span: 'century' })).toEqual([1601, 1700]);
    expect(spanYears(gregorian, { year: 1700, span: 'century' })).toEqual([1601, 1700]);
    expect(spanYears(gregorian, { year: 5, span: 'decade' })).toEqual([1, 9]);
    expect(spanYears(gregorian, { year: 5, span: 'century' })).toEqual([1, 100]);
    const range = dateRange(gregorian, { year: 1650, span: 'decade' });
    expect(range).toEqual({ first: yearStart(gregorian, 1650), last: yearEnd(gregorian, 1659) });
  });

  it('decades and centuries before year 1 count the other way', () => {
    // The 650s BCE: 659 BCE to 650 BCE, which are the years -658 to -649.
    expect(spanYears(gregorian, { year: -649, span: 'decade' })).toEqual([-658, -649]);
    expect(spanYears(gregorian, { year: -658, span: 'decade' })).toEqual([-658, -649]);
    // The 3rd century BCE: 300 BCE to 201 BCE.
    expect(spanYears(gregorian, { year: -250, span: 'century' })).toEqual([-299, -200]);
    // The first decade and century BCE have no year 0 in them.
    expect(spanYears(gregorian, { year: 0, span: 'decade' })).toEqual([-8, 0]);
    expect(spanYears(gregorian, { year: 0, span: 'century' })).toEqual([-99, 0]);
  });

  it('in a calendar that runs through zero, decades do too', () => {
    expect(spanYears(kharan, { year: 3, span: 'decade' })).toEqual([0, 9]);
    expect(spanYears(kharan, { year: -3, span: 'decade' })).toEqual([-10, -1]);
    expect(spanYears(kharan, { year: -3, span: 'century' })).toEqual([-99, 0]);
  });

  it('reaches past the engine in whole years', () => {
    const range = dateRange(gregorian, { year: -13_800_000_000 });
    expect(range.last - range.first).toBeGreaterThan(363);
    expect(range.last - range.first).toBeLessThan(367);
    expect(isBeforeBigBang(gregorian, { year: -13_800_000_000 })).toBe(true);
    expect(isBeforeBigBang(gregorian, { year: -13_700_000_000 })).toBe(false);
    expect(isBeforeBigBang(gregorian, { year: 1066 })).toBe(false);
    // A Kharan year is 412 days, so fewer of them reach back as far.
    expect(isBeforeBigBang(kharan, { year: -12_300_000_000 })).toBe(true);
  });

  it('sorts dates by when they start, the shorter first', () => {
    const dates: FuzzyDate[] = [{ year: 1650, span: 'decade' }, { year: 1650, month: 1, day: 1 }, { year: 1649 }, { year: 1650 }, { year: 1650, month: 1 }];
    expect(dates.sort((a, b) => compareDates(gregorian, a, b)).map(encodeDate)).toEqual(['1649', '1650-1-1', '1650-1', '1650', '1650D']);
  });

  it('knows how fine and how sure a date is', () => {
    expect(precisionOf({ year: 1 })).toBe('year');
    expect(precisionOf({ year: 1, month: 2 })).toBe('month');
    expect(precisionOf({ year: 1, intercalary: 1, day: 1 })).toBe('day');
    expect(precisionOf({ year: 1, span: 'century' })).toBe('century');
    expect(isUncertain({ year: 1 })).toBe(false);
    expect(isUncertain({ year: 1, circa: true })).toBe(true);
    expect(isUncertain({ year: 1, span: 'decade' })).toBe(true);
  });
});

describe('dates as words', () => {
  it('writes every kind of date', () => {
    expect(formatDate(selunnan, { year: 1022, month: 9, day: 17 })).toBe('17 Harvestmoon 1022 FS');
    expect(formatDate(selunnan, { year: 1022, month: 9, day: 17 }, 'short')).toBe('17 Har 1022 FS');
    expect(formatDate(selunnan, { year: 1022, month: 9 })).toBe('Harvestmoon 1022 FS');
    expect(formatDate(selunnan, { year: 1022 })).toBe('1022 FS');
    expect(formatDate(selunnan, { year: 1022, circa: true })).toBe('c. 1022 FS');
    expect(formatDate(selunnan, { year: -2, month: 1, day: 3 })).toBe('3 Frostmoon 3 Before the Founding');
    expect(formatDate(selunnan, { year: 1020, intercalary: 1, day: 1 })).toBe('Midyear Day 1020 FS');
    expect(formatDate(meridian, { year: 12, intercalary: 1, day: 2 })).toBe('2 Festival 12 YR');
    expect(formatDate(meridian, { year: 12, intercalary: 1 })).toBe('Festival 12 YR');
    expect(formatDate(gregorian, { year: 1650, span: 'decade' })).toBe('1650s CE');
    expect(formatDate(gregorian, { year: 1650, span: 'decade', circa: true })).toBe('c. 1650s CE');
    expect(formatDate(gregorian, { year: 1601, span: 'century' })).toBe('17th century CE');
    expect(formatDate(gregorian, { year: -658, span: 'decade' })).toBe('650s BCE');
    expect(formatDate(gregorian, { year: -299, span: 'century' })).toBe('3rd century BCE');
    expect(formatDate(gregorian, { year: 1, span: 'decade' })).toBe('0s CE');
    expect(formatDate(kharan, { year: 410, span: 'decade' })).toBe('410s KY');
    expect(formatDate(kharan, { year: -10, span: 'decade' })).toBe('\u221210s KY');
    expect(formatDate(kharan, { year: -99, span: 'century' })).toBe('\u221299 KY to 0 KY');
    expect(formatDate(kharan, { year: 1, span: 'century' })).toBe('1st century KY');
    expect(formatDate(gregorian, { year: 1 - 14_000_000_000 })).toBe('14,000,000,000 BCE');
  });

  it('reads what people type', () => {
    const cases: [string, string | null][] = [
      ['1650', '1650'],
      ['1650 CE', '1650'],
      ['AD 1066', '1066'],
      ['1066 AD', '1066'],
      ['44 BC', '-43'],
      ['44 bce', '-43'],
      ['44BCE', '-43'],
      ['-200', '-199'],
      ['\u2212200', '-199'],
      ['c. 1650', '~1650'],
      ['c.1650', '~1650'],
      ['c 1650', '~1650'],
      ['ca. 1650', '~1650'],
      ['circa 1650', '~1650'],
      ['about 1650', '~1650'],
      ['~1650', '~1650'],
      ['1650s', '1650D'],
      ['1657s', '1650D'],
      ['c. 1650s', '~1650D'],
      ['650s BCE', '-658D'],
      ['0s', '1D'],
      ['17th century', '1601C'],
      ['17 century CE', '1601C'],
      ['3rd century BCE', '-299C'],
      ['1st century BC', '-99C'],
      ['12 November 2026', '2026-11-12'],
      ['12 Nov 2026', '2026-11-12'],
      ['12th of November, 2026', '2026-11-12'],
      ['november 2026', '2026-11'],
      ['Nov 2026 CE', '2026-11'],
      ['15 March 44 BCE', '-43-3-15'],
      ['2026-11-12', '2026-11-12'],
      ['2026-11', '2026-11'],
      ['-0043-03-15', '-43-3-15'],
      ['29 February 2024', '2024-2-29'],
      ['14,000,000,000 BCE', '-13999999999'],
      ['1,066', '1066'],
      ['1601 to 1700', '1601C'],
      ['1650 CE to 1659 CE', '1650D'],
      ['1650 to 1660', null],
      // Not dates, or dates that do not exist.
      ['', null],
      ['soon', null],
      ['29 February 2023', null],
      ['31 April 2020', null],
      ['0 CE', null],
      ['0', null],
      ['0 BCE', null],
      ['-5 BCE', null],
      ['13 Ju 2020', null],
      ['Ma 2020', null],
      ['2020-13', null],
      ['2020-00-01', null],
      ['1 Smarch 2020', null],
      ['June 20,000,000 12', null],
      ['March 20000000', null],
      ['0th century', null],
      ['99999999999999', null],
    ];
    for (const [text, expected] of cases) {
      const parsed = parseDate(gregorian, text);
      expect(parsed === null ? null : encodeDate(parsed), text).toBe(expected);
    }
  });

  it('reads the names of an invented calendar', () => {
    const cases: [string, string | null][] = [
      ['17 Harvestmoon 1022 FS', '1022-9-17'],
      ['17 harv 1022', '1022-9-17'],
      ['17 Har 1022', '1022-9-17'],
      ['Midyear Day 1020 FS', '1020-i1-1'],
      ['Midyear Day 1021 FS', null],
      ['midyear 1020', '1020-i1-1'],
      ['3 Before the Founding', '-2'],
      ['3 Frostmoon 3 before the founding', '-2-1-3'],
      ['1020-i1-1', '1020-i1-1'],
      ['29 Frostmoon 1022', null],
      // "Mis" could only be Mistmoon; "M" and "Mi" are too short to trust.
      ['Mis 1022', '1022-10'],
      ['Mi 1022', null],
    ];
    for (const [text, expected] of cases) {
      const parsed = parseDate(selunnan, text);
      expect(parsed === null ? null : encodeDate(parsed), text).toBe(expected);
    }
    expect(encodeDate(parseDate(meridian, '6 Festival 4 YR')!)).toBe('4-i1-6');
    expect(parseDate(meridian, '6 Festival 5 YR')).toBeNull();
    expect(encodeDate(parseDate(kharan, '-200')!)).toBe('-200');
    expect(encodeDate(parseDate(kharan, '0')!)).toBe('0');
    expect(encodeDate(parseDate(kharan, 'Dawnturn 7 KY')!)).toBe('7-i1-1');
    expect(encodeDate(parseDate(kharan, '41 Jurn 3')!)).toBe('3-10-41');
    expect(parseDate(kharan, '42 Jurn 3')).not.toBeNull();
    expect(parseDate(kharan, '42 Jurn 4')).toBeNull();
    expect(encodeDate(parseDate(kharan, '-10s')!)).toBe('-10D');
  });

  it.each(ENGINES)('%s: reads back everything it writes', (_name, engine) => {
    const next = random(11);
    for (let i = 0; i < 4000; i++) {
      const year = i % 7 === 0 ? between(next, -3_000_000, 3_000_000) : between(next, -3000, 3000);
      const date: FuzzyDate = { year };
      const kind = between(next, 0, 5);
      if (kind === 0) date.span = 'decade';
      else if (kind === 1) date.span = 'century';
      else if (kind >= 3) {
        const parts = partsOf(engine, year).filter((part) => part.days > 0);
        const part = parts[between(next, 0, parts.length - 1)]!;
        date[part.kind] = part.index;
        const single = part.kind === 'intercalary' && engine.intercalary[part.index - 1]!.single;
        if (kind >= 4 || single) date.day = between(next, 1, part.days);
      }
      if (between(next, 0, 3) === 0) date.circa = true;
      const clean = cleanDate(engine, date)!.date;
      for (const style of ['long', 'short'] as const) {
        const written = formatDate(engine, clean, style);
        const read = parseDate(engine, written);
        expect(read, `${written} (${encodeDate(clean)})`).toEqual(clean);
      }
      expect(decodeDate(encodeDate(clean))).toEqual(clean);
      const range = dateRange(engine, clean);
      expect(range.last).toBeGreaterThanOrEqual(range.first);
      expect(isValidDate(engine, clean)).toBe(true);
    }
  });
});

describe('dates from anywhere', () => {
  it('reads the compact form and nothing else', () => {
    expect(decodeDate('1022-9-17')).toEqual({ year: 1022, month: 9, day: 17 });
    expect(decodeDate('~-43-3')).toEqual({ year: -43, month: 3, circa: true });
    expect(decodeDate('1020-i1-1')).toEqual({ year: 1020, intercalary: 1, day: 1 });
    expect(decodeDate('1601C')).toEqual({ year: 1601, span: 'century' });
    expect(decodeDate('-0')).toEqual({ year: 0 });
    for (const junk of [null, 7, '', 'x', '1022-', '1022--3', '1022-9-17-2', '1e3', '999999999999', '1650d', ' 1650', '1650D-3']) expect(decodeDate(junk)).toBeNull();
  });

  it('makes a date fit the calendar', () => {
    expect(cleanDate(gregorian, '2023-2-31')).toEqual({ date: { year: 2023, month: 2, day: 28 }, changed: true });
    expect(cleanDate(gregorian, { year: 2023, month: 14, day: 3 })).toEqual({ date: { year: 2023 }, changed: true });
    expect(cleanDate(gregorian, { year: 2023, month: 3, day: 0 })).toEqual({ date: { year: 2023, month: 3 }, changed: true });
    expect(cleanDate(gregorian, { year: 2023, day: 3 })).toEqual({ date: { year: 2023 }, changed: true });
    expect(cleanDate(gregorian, { year: 1657, span: 'decade', month: 3 })).toEqual({ date: { year: 1650, span: 'decade' }, changed: true });
    expect(cleanDate(gregorian, { year: 1650, span: 'decade', circa: true })).toEqual({ date: { year: 1650, span: 'decade', circa: true }, changed: false });
    expect(cleanDate(selunnan, { year: 1021, intercalary: 1, day: 1 })).toEqual({ date: { year: 1021 }, changed: true });
    expect(cleanDate(selunnan, { year: 1020, intercalary: 1, day: 1 })).toEqual({ date: { year: 1020, intercalary: 1, day: 1 }, changed: false });
    expect(cleanDate(gregorian, { year: 2023, month: 3, intercalary: 1 })).toEqual({ date: { year: 2023, month: 3 }, changed: true });
    // Beyond the engine there are only years.
    expect(cleanDate(gregorian, { year: 20_000_000, month: 3, day: 1 })).toEqual({ date: { year: 20_000_000 }, changed: true });
    expect(cleanDate(gregorian, { year: MAX_YEAR })).toEqual({ date: { year: MAX_YEAR }, changed: false });
    for (const junk of [null, 7, 'x', [], {}, { year: 1.5 }, { year: '1650' }, { year: MAX_YEAR + 1 }, { year: Infinity }, { year: NaN }]) expect(cleanDate(gregorian, junk)).toBeNull();
    expect(cleanDate(gregorian, { year: 5, circa: 'yes', span: 'aeon', extra: 1 })).toEqual({ date: { year: 5 }, changed: false });
  });
});
