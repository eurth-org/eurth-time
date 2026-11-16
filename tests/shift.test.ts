import { describe, expect, it } from 'vitest';
import { exampleById } from '../src/content/examples';
import { MAX_YEAR } from '../src/tool/dates';
import { dateRange, encodeDate, isValidDate, type FuzzyDate } from '../src/tool/fuzzy';
import { engineFor } from '../src/tool/engine';
import { countItems, type Ref } from '../src/tool/model';
import { keyAction } from '../src/tool/nav';
import { normalizeTimeline } from '../src/tool/normalize';
import { moveInTime, shiftDate, stepDate } from '../src/tool/shift';
import { ENGINES, between, gregorian, kharan, meridian, random, selunnan } from './helpers/engines';

const code = (date: FuzzyDate) => encodeDate(date);

describe('a date carried along the axis', () => {
  it('moves a day by days', () => {
    expect(code(shiftDate(gregorian, { year: 1869, month: 3, day: 18 }, 14))).toBe('1869-4-1');
    expect(code(shiftDate(gregorian, { year: 1869, month: 3, day: 18 }, -18))).toBe('1869-2-28');
    expect(code(shiftDate(gregorian, { year: 1869, month: 3, day: 18 }, 0.4))).toBe('1869-3-18');
    expect(code(shiftDate(gregorian, { year: 1869, month: 3, day: 18 }, 365.6))).toBe('1870-3-19');
    // Across a day that belongs to no month.
    expect(code(shiftDate(selunnan, { year: 1020, month: 7, day: 28 }, 1))).toBe('1020-i1-1');
    expect(code(shiftDate(selunnan, { year: 1020, month: 7, day: 28 }, 2))).toBe('1020-8-1');
  });

  it('keeps a date as fine as it was given', () => {
    expect(code(shiftDate(gregorian, { year: 1869, month: 3 }, 40))).toBe('1869-4');
    expect(code(shiftDate(gregorian, { year: 1869, month: 3 }, 5))).toBe('1869-3');
    expect(code(shiftDate(gregorian, { year: 1789 }, 800))).toBe('1791');
    expect(code(shiftDate(gregorian, { year: 1789 }, 100))).toBe('1789');
    expect(code(shiftDate(gregorian, { year: 1789, circa: true }, -3700))).toBe('~1779');
    // A decade moves by decades, a century by centuries.
    expect(code(shiftDate(gregorian, { year: 1830, span: 'decade' }, 365 * 14))).toBe('1840D');
    expect(code(shiftDate(gregorian, { year: 1830, span: 'decade' }, 365 * 4))).toBe('1830D');
    expect(code(shiftDate(gregorian, { year: 1701, span: 'century' }, -365 * 160))).toBe('1501C');
    // Before the 10s come the first nine years, and before those the last nine before year 1:
    // round numbers count the other way there.
    expect(code(shiftDate(gregorian, { year: 10, span: 'decade' }, -3652))).toBe('1D');
    expect(code(shiftDate(gregorian, { year: 10, span: 'decade' }, -3652 * 2))).toBe('-8D');
    expect(code(shiftDate(gregorian, { year: 10, span: 'decade' }, -3652 * 3))).toBe('-18D');
    expect(code(shiftDate(gregorian, { year: -18, span: 'decade' }, 3652 * 3))).toBe('10D');
    expect(code(shiftDate(gregorian, { year: 1, span: 'century' }, -36525))).toBe('-99C');
    expect(code(shiftDate(gregorian, { year: -99, span: 'century' }, 36525 * 2))).toBe('101C');
    // A calendar that runs through zero has decades that do too.
    expect(code(shiftDate(kharan, { year: 0, span: 'decade' }, -4124))).toBe('-10D');
  });

  it('leaves a date alone for no days, or for nonsense', () => {
    const date = { year: 1789 };
    expect(shiftDate(gregorian, date, 0)).toBe(date);
    expect(shiftDate(gregorian, date, NaN)).toBe(date);
    expect(shiftDate(gregorian, date, Infinity)).toBe(date);
    expect(code(shiftDate(gregorian, { year: MAX_YEAR }, 1e15))).toBe(String(MAX_YEAR));
  });

  it.each(ENGINES)('%s: always lands on a date that exists', (_name, engine) => {
    const next = random(61);
    for (let i = 0; i < 2000; i++) {
      const year = between(next, -3000, 3000);
      const parts = engine.parts(year).filter((part) => part.days > 0);
      const part = parts[between(next, 0, parts.length - 1)]!;
      const kind = between(next, 0, 4);
      const date: FuzzyDate = kind === 0 ? { year } : kind === 1 ? { year: Math.floor(year / 10) * 10 || 10, span: 'decade' } : kind === 2 ? { year, [part.kind]: part.index } : { year, [part.kind]: part.index, day: between(next, 1, part.days) };
      if (!isValidDate(engine, date)) continue;
      const days = between(next, -200_000, 200_000);
      const moved = shiftDate(engine, date, days);
      expect(isValidDate(engine, moved), `${code(date)} + ${days} = ${code(moved)}`).toBe(true);
      // A day moves by exactly that many days, and comes back.
      if (date.day !== undefined && moved.day !== undefined) {
        expect(dateRange(engine, moved).first - dateRange(engine, date).first).toBe(days);
        expect(shiftDate(engine, moved, -days)).toEqual(date);
      }
      for (const unit of ['day', 'month', 'year'] as const) {
        const stepped = stepDate(engine, date, unit, between(next, -30, 30));
        expect(isValidDate(engine, stepped), `${code(date)} by ${unit} = ${code(stepped)}`).toBe(true);
      }
    }
  });
});

describe('a date moved by a key', () => {
  it('steps by a day, a month or a year', () => {
    const date = { year: 1869, month: 3, day: 18 };
    expect(code(stepDate(gregorian, date, 'day', 1))).toBe('1869-3-19');
    expect(code(stepDate(gregorian, date, 'month', 1))).toBe('1869-4-18');
    expect(code(stepDate(gregorian, date, 'year', -1))).toBe('1868-3-18');
    expect(code(stepDate(gregorian, date, 'month', -3))).toBe('1868-12-18');
    expect(code(stepDate(gregorian, date, 'month', 10))).toBe('1870-1-18');
    expect(stepDate(gregorian, date, 'day', 0)).toBe(date);
  });

  it('keeps the day where the month is long enough, and the last day where it is not', () => {
    expect(code(stepDate(gregorian, { year: 2023, month: 1, day: 31 }, 'month', 1))).toBe('2023-2-28');
    expect(code(stepDate(gregorian, { year: 2024, month: 2, day: 29 }, 'year', 1))).toBe('2025-2-28');
    // Through the festival days at the end of the Meridian year, which are five or six.
    expect(code(stepDate(meridian, { year: 3, month: 12, day: 30 }, 'month', 1))).toBe('3-i1-5');
    expect(code(stepDate(meridian, { year: 3, month: 12, day: 30 }, 'month', 2))).toBe('4-1-30');
    // Midyear Day comes only every fifth year: in the others, the eighth month follows the seventh.
    expect(code(stepDate(selunnan, { year: 1021, month: 7, day: 3 }, 'month', 1))).toBe('1021-8-3');
    expect(code(stepDate(selunnan, { year: 1020, month: 7, day: 3 }, 'month', 1))).toBe('1020-i1-1');
    expect(code(stepDate(kharan, { year: 7, intercalary: 2, day: 1 }, 'month', 1))).toBe('8-i1-1');
  });

  it('moves a looser date by its own measure', () => {
    expect(code(stepDate(gregorian, { year: 1789 }, 'day', 1))).toBe('1790');
    expect(code(stepDate(gregorian, { year: 1789 }, 'month', -1))).toBe('1788');
    expect(code(stepDate(gregorian, { year: 1869, month: 3 }, 'day', 1))).toBe('1869-4');
    expect(code(stepDate(gregorian, { year: 1830, span: 'decade' }, 'day', 1))).toBe('1840D');
    expect(code(stepDate(gregorian, { year: 1701, span: 'century', circa: true }, 'year', -1))).toBe('~1601C');
    expect(code(stepDate(gregorian, { year: 1640, circa: true }, 'year', 1))).toBe('~1641');
    // Beyond what the engine counts day by day there are only years.
    expect(code(stepDate(gregorian, { year: -13_800_000_000 }, 'month', 1))).toBe('-13799999999');
  });

  it('is asked for with Alt and an arrow', () => {
    expect(keyAction('ArrowRight', { alt: true })).toEqual({ type: 'nudge', by: 1, end: false });
    expect(keyAction('ArrowLeft', { alt: true })).toEqual({ type: 'nudge', by: -1, end: false });
    expect(keyAction('ArrowLeft', { alt: true, shift: true })).toEqual({ type: 'nudge', by: -1, end: true });
    // Alt with anything else is the browser's or the system's.
    for (const key of ['ArrowUp', 'ArrowDown', 'Home', 'd', '+', 'Enter']) expect(keyAction(key, { alt: true })).toBeNull();
    expect(keyAction('ArrowRight')).toEqual({ type: 'move', how: 'right' });
  });
});

describe('a thing moved in time', () => {
  const coast = exampleById('oriental-coast')!.timeline;
  const later = (days: number) => (date: FuzzyDate) => shiftDate(gregorian, date, days);
  const treaty: Ref = { kind: 'event', track: 2, index: 1 };
  const war: Ref = { kind: 'span', track: 2, index: 0 };
  const republic: Ref = { kind: 'span', track: 0, index: 1 };

  it('moves an event, and nothing else', () => {
    const moved = moveInTime(coast, gregorian, treaty, 'all', later(366 * 2));
    expect(code(moved.tracks[2]!.events[1]!.date)).toBe('1791');
    expect(countItems(moved)).toEqual(countItems(coast));
    expect({ ...moved, tracks: moved.tracks.map((track, t) => (t === 2 ? coast.tracks[2] : track)) }).toEqual(coast);
    expect(code(coast.tracks[2]!.events[1]!.date)).toBe('1789');
    expect(normalizeTimeline(moved).issues).toEqual([]);
  });

  it('moves a span whole, or by one end', () => {
    const span = (timeline: typeof coast) => [code(timeline.tracks[2]!.spans[0]!.from), code(timeline.tracks[2]!.spans[0]!.to!)];
    expect(span(coast)).toEqual(['1702', '1789']);
    expect(span(moveInTime(coast, gregorian, war, 'all', later(3653)))).toEqual(['1712', '1799']);
    expect(span(moveInTime(coast, gregorian, war, 'from', later(3653)))).toEqual(['1712', '1789']);
    expect(span(moveInTime(coast, gregorian, war, 'to', later(-3653)))).toEqual(['1702', '1779']);
    // An era moves the same way.
    const era = moveInTime(coast, gregorian, { kind: 'era', index: 0 }, 'to', later(3653)).eras[0]!;
    expect([code(era.from), code(era.to!)]).toEqual(['1600', '1830']);
  });

  it('never puts an end before its start, and leaves an open end open', () => {
    expect(moveInTime(coast, gregorian, war, 'to', later(-365 * 100))).toBe(coast);
    expect(moveInTime(coast, gregorian, war, 'from', later(365 * 100))).toBe(coast);
    // The two ends may meet in the same year.
    expect(code(moveInTime(coast, gregorian, war, 'to', later(-365.25 * 87)).tracks[2]!.spans[0]!.to!)).toBe('1702');
    const open = moveInTime(coast, gregorian, republic, 'all', later(3653));
    expect([code(open.tracks[0]!.spans[1]!.from), open.tracks[0]!.spans[1]!.to]).toEqual(['1881', null]);
    expect(moveInTime(coast, gregorian, republic, 'to', later(3653))).toBe(coast);
  });

  it('gives back the same timeline when nothing moves or nothing is there', () => {
    expect(moveInTime(coast, gregorian, treaty, 'all', later(10))).toBe(coast);
    expect(moveInTime(coast, gregorian, treaty, 'all', (date) => date)).toBe(coast);
    expect(moveInTime(coast, gregorian, { kind: 'event', track: 9, index: 0 }, 'all', later(999))).toBe(coast);
  });

  it('moves by a key’s step in any calendar', () => {
    const selunna = exampleById('selunna')!.timeline;
    const engine = engineFor(selunna.calendar);
    const founding: Ref = { kind: 'event', track: 0, index: 0 };
    const moved = moveInTime(selunna, engine, founding, 'all', (date) => stepDate(engine, date, 'month', -1));
    expect(code(moved.tracks[0]!.events[0]!.date)).toBe('0-13-1');
    const corvan: Ref = { kind: 'span', track: 1, index: 1 };
    const longer = moveInTime(selunna, engine, corvan, 'to', (date) => stepDate(engine, date, 'day', 5));
    expect([code(longer.tracks[1]!.spans[1]!.from), code(longer.tracks[1]!.spans[1]!.to!)]).toEqual(['351-10-3', '352-2-8']);
  });
});
