import { describe, expect, it } from 'vitest';
import { BIG_BANG_DAYS, MAX_YEAR, compactNumber, formatYear, groupDigits, ordinal, partsOf, yearEnd, yearOf, yearStart } from '../src/time/dates';
import { decodeCalendar, encodeCalendar, engineFor, isCalendar } from '../src/time/engine';
import { cleanSpec } from '../src/time/plain';
import { KHARAN, SELUNNAN } from '../src/content/calendars';
import { ENGINES, between, gregorian, kharan, meridian, random, selunnan, tidewatch } from './helpers/engines';

/** The day number of 1 January of a Gregorian year, from JavaScript's own calendar. */
function jsYearStart(year: number): number {
  const at = (y: number) => {
    const date = new Date(Date.UTC(2000, 0, 1));
    date.setUTCFullYear(y, 0, 1);
    return date.getTime();
  };
  return Math.round((at(year) - at(1)) / 86_400_000);
}

describe('the Gregorian engine', () => {
  it('starts every year where JavaScript does', () => {
    for (let year = -4000; year <= 4000; year++) expect(gregorian.yearStart(year)).toBe(jsYearStart(year));
    const next = random(1);
    for (let i = 0; i < 2000; i++) {
      const year = between(next, -250_000, 250_000);
      expect(gregorian.yearStart(year)).toBe(jsYearStart(year));
    }
  });

  it('knows 12 November 2026', () => {
    const parts = gregorian.parts(2026);
    expect(parts[10]).toMatchObject({ kind: 'month', index: 11, name: 'November', days: 30 });
    expect(parts[10]!.start + 11).toBe(739_931);
    expect(gregorian.parts(2024)[1]!.days).toBe(29);
    expect(gregorian.parts(1900)[1]!.days).toBe(28);
    expect(gregorian.parts(2000)[1]!.days).toBe(29);
    expect(gregorian.parts(0)[1]!.days).toBe(29);
    expect(gregorian.meanYear).toBeCloseTo(365.2425, 10);
  });
});

describe('every engine', () => {
  it.each(ENGINES)('%s: years follow one another with no gap', (_name, engine) => {
    const next = random(2);
    const years = [engine.minYear, engine.minYear + 1, -1, 0, 1, 2, engine.maxYear - 1, engine.maxYear];
    for (let i = 0; i < 3000; i++) years.push(between(next, -20_000, 20_000));
    for (let i = 0; i < 500; i++) years.push(between(next, engine.minYear, engine.maxYear));
    for (const year of years) {
      const parts = engine.parts(year);
      const length = parts.reduce((sum, part) => sum + part.days, 0);
      expect(parts[0]!.start).toBe(engine.yearStart(year));
      expect(engine.yearStart(year) + length).toBe(engine.yearStart(year + 1));
      let at = engine.yearStart(year);
      for (const part of parts) {
        expect(part.start).toBe(at);
        at += part.days;
      }
      expect(engine.yearOf(engine.yearStart(year))).toBe(year);
      expect(engine.yearOf(engine.yearStart(year + 1) - 1)).toBe(year);
    }
    expect(engine.yearStart(1)).toBe(0);
  });

  it.each(ENGINES)('%s: the mean year is the long-run average', (_name, engine) => {
    // A whole number of every calendar's leap cycle.
    const span = 9_600_000;
    expect((engine.yearStart(span + 1) - engine.yearStart(1)) / span).toBeCloseTo(engine.meanYear, 9);
  });

  it.each(ENGINES)('%s: deep time carries on smoothly past the engine', (_name, engine) => {
    const next = random(3);
    const years = [engine.maxYear, engine.maxYear + 1, engine.maxYear + 2, engine.minYear, engine.minYear - 1, engine.minYear - 2, MAX_YEAR, -MAX_YEAR, -13_787_000_000];
    for (let i = 0; i < 500; i++) years.push(between(next, -20_000_000_000, 20_000_000_000));
    for (const year of years) {
      if (year < MAX_YEAR) expect(yearStart(engine, year + 1)).toBeGreaterThan(yearStart(engine, year));
      expect(yearOf(engine, yearStart(engine, year))).toBe(year);
      expect(yearOf(engine, yearEnd(engine, Math.min(year, MAX_YEAR - 1)))).toBe(Math.min(year, MAX_YEAR - 1));
    }
    expect(Number.isSafeInteger(yearStart(engine, MAX_YEAR))).toBe(true);
    expect(Number.isSafeInteger(yearStart(engine, -MAX_YEAR))).toBe(true);
    expect(partsOf(engine, engine.maxYear + 5)).toEqual([]);
    expect(partsOf(engine, 5).length).toBeGreaterThan(0);
    expect(yearOf(engine, 0.5)).toBe(1);
    expect(yearOf(engine, -0.5)).toBe(0);
  });
});

describe('the invented calendars', () => {
  it('Selunnan: 17 Harvestmoon 1022 FS is day 372088, as @eurth/calendar has it', () => {
    const harvestmoon = selunnan.parts(1022).find((part) => part.kind === 'month' && part.index === 9)!;
    expect(harvestmoon.start + 16).toBe(372_088);
    expect(selunnan.months[8]).toEqual({ name: 'Harvestmoon', short: 'Har' });
  });

  it('Selunnan: Midyear Day comes every fifth year, after the seventh month', () => {
    expect(selunnan.parts(1020).map((part) => part.days).reduce((a, b) => a + b)).toBe(365);
    expect(selunnan.parts(1021).map((part) => part.days).reduce((a, b) => a + b)).toBe(364);
    const parts = selunnan.parts(1020);
    expect(parts[7]).toMatchObject({ kind: 'intercalary', index: 1, name: 'Midyear Day', days: 1 });
    expect(selunnan.parts(1021)[7]!.days).toBe(0);
    expect(selunnan.intercalary).toEqual([{ name: 'Midyear Day', single: true }]);
  });

  it('Meridian: five festival days, six when the year divides by 4 but not by 128', () => {
    const festival = (year: number) => meridian.parts(year).at(-1)!;
    expect(festival(3)).toMatchObject({ kind: 'intercalary', name: 'Festival', days: 5 });
    expect(festival(4).days).toBe(6);
    expect(festival(128).days).toBe(5);
    expect(festival(256).days).toBe(5);
    expect(festival(132).days).toBe(6);
    expect(meridian.intercalary[0]!.single).toBe(false);
  });

  it('Tidewatch: two leap rules can land in one year', () => {
    const length = (year: number) => tidewatch.parts(year).reduce((sum, part) => sum + part.days, 0);
    expect(length(1)).toBe(354);
    expect(length(3)).toBe(355);
    expect(length(30)).toBe(356);
  });

  it('Kharan: the year opens with Dawnturn and closes with Duskturn', () => {
    const parts = kharan.parts(7);
    expect(parts[0]).toMatchObject({ kind: 'intercalary', index: 1, name: 'Dawnturn', days: 1 });
    expect(parts.at(-1)).toMatchObject({ kind: 'intercalary', index: 2, name: 'Duskturn', days: 1 });
    expect(parts.length).toBe(12);
    expect(parts.reduce((sum, part) => sum + part.days, 0)).toBe(412);
    expect(kharan.parts(3).reduce((sum, part) => sum + part.days, 0)).toBe(413);
    expect(kharan.parts(60).reduce((sum, part) => sum + part.days, 0)).toBe(412);
    expect(kharan.eraBefore).toBe('');
  });
});

describe('years as words', () => {
  it('writes years on both sides of year 1', () => {
    expect(formatYear(selunnan, 1022)).toBe('1022 FS');
    expect(formatYear(selunnan, 0)).toBe('1 Before the Founding');
    expect(formatYear(selunnan, -2)).toBe('3 Before the Founding');
    expect(formatYear(kharan, 0)).toBe('0 KY');
    expect(formatYear(kharan, -2)).toBe('\u22122 KY');
    expect(formatYear(gregorian, 2026)).toBe('2026 CE');
    expect(formatYear(gregorian, -43)).toBe('44 BCE');
    expect(formatYear(gregorian, 2026, { era: false })).toBe('2026');
    expect(formatYear(engineFor({ months: [{ name: 'Only', days: 10 }] }), 12)).toBe('12');
  });

  it('groups long numbers and shortens very long ones', () => {
    expect(groupDigits(9999)).toBe('9999');
    expect(groupDigits(10_000)).toBe('10,000');
    expect(groupDigits(-13_787_000_000)).toBe('\u221213,787,000,000');
    expect(compactNumber(14_000_000_000)).toBe('14 bn');
    expect(compactNumber(13_787_000_000)).toBe('13.79 bn');
    expect(compactNumber(2_500_000)).toBe('2.5 m');
    expect(compactNumber(12_500)).toBe('12,500');
    expect(formatYear(gregorian, 1 - 14_000_000_000, { compact: true })).toBe('14 bn BCE');
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th']);
  });

  it('puts the Big Bang some 13.8 thousand million years back', () => {
    expect(yearOf(gregorian, -BIG_BANG_DAYS)).toBeLessThan(-13_780_000_000);
    expect(yearOf(gregorian, -BIG_BANG_DAYS)).toBeGreaterThan(-13_790_000_000);
  });
});

describe('calendars from anywhere', () => {
  it('falls back to Gregorian for anything that is not a calendar', () => {
    for (const junk of [null, undefined, 7, 'x', [], {}, { months: [] }, { months: 'June' }, { months: [{ name: '', days: 3 }] }, { months: [{ name: 'A', days: 0 }] }]) {
      expect(engineFor(junk).name).toBe('Gregorian calendar');
      expect(isCalendar(junk)).toBe(false);
    }
    expect(isCalendar(SELUNNAN)).toBe(true);
  });

  it('drops what is out of bounds and keeps the rest', () => {
    const spec = cleanSpec({
      name: `  A\tname${'x'.repeat(200)}`,
      era: 'E'.repeat(50),
      months: [{ name: 'One', days: 30 }, { name: 'Bad', days: 1.5 }, 'nope', { name: 'Two', days: 5000 }, { name: 'Three', days: 20, short: 'Thr' }],
      intercalary: [{ name: 'End', after: 99, days: 2 }, { name: 'Neg', after: 0, days: -1 }],
      leap: [
        { every: 4, except: [100, 400, 'x', 3], days: 1, to: { month: 2 } },
        { every: 0, except: [], days: 1, to: { month: 1 } },
        { every: 4, except: [], days: 1, to: { month: 9 } },
        { every: 2, except: [], days: 1, to: { intercalary: 1 } },
      ],
    })!;
    expect(spec.name.length).toBe(80);
    expect(spec.name.startsWith('A name')).toBe(true);
    expect(spec.era.length).toBe(20);
    expect(spec.months).toEqual([{ name: 'One', days: 30 }, { name: 'Three', short: 'Thr', days: 20 }]);
    expect(spec.intercalary).toEqual([{ name: 'End', after: 2, days: 2 }]);
    expect(spec.leap).toEqual([
      { every: 4, except: [100, 400], days: 1, to: { month: 2 } },
      { every: 2, except: [], days: 1, to: { intercalary: 1 } },
    ]);
    const engine = engineFor({ months: [{ name: 'One', days: 30 }], leap: [{ every: 7, except: [9_999_991, 9_999_973], days: 1, to: { month: 1 } }] });
    expect(engine.parts(7)[0]!.days).toBe(31);
  });

  it('carries a calendar through a link', () => {
    const text = encodeCalendar(KHARAN);
    expect(text).toMatch(/^1\.[A-Za-z0-9_-]+$/);
    expect(decodeCalendar(text)).toEqual(KHARAN);
    for (const junk of [null, '', 'x', '1.', '2.e30', '1.e30', `1.${'A'.repeat(70_000)}`, '1.!!!']) expect(decodeCalendar(junk)).toBeNull();
  });
});
