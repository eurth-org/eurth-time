import { describe, expect, it } from 'vitest';
import { MIN_VISIBLE_DAYS, YEAR_STEPS, allTime, clampView, daysAt, defaultView, fitView, panView, resizeView, scaleOf, tickOpacity, ticks, viewLabel, viewPrecision, xOf, yearStep, zoomView, type View } from '../src/time/axis';
import { BIG_BANG_DAYS, yearEnd, yearStart } from '../src/time/dates';
import type { DateEngine } from '../src/time/engine';
import { ENGINES, between, gregorian, kharan, random, selunnan } from './helpers/engines';

const years = (engine: DateEngine, from: number, to: number, width = 900): View => ({ start: yearStart(engine, from), end: yearStart(engine, to), width });
const labels = (engine: DateEngine, view: View) => ticks(engine, view).filter((tick) => tick.label !== '').map((tick) => tick.label);
/** The labels that are fully there, leaving out the ones still fading in. */
const solid = (engine: DateEngine, view: View) => ticks(engine, view).filter((tick) => tick.opacity === 1).map((tick) => tick.label);

describe('the view', () => {
  it('turns days into pixels and back', () => {
    const view = years(gregorian, 1600, 2030);
    expect(xOf(view, view.start)).toBe(0);
    expect(xOf(view, view.end)).toBeCloseTo(900, 9);
    expect(daysAt(view, xOf(view, 700_000))).toBeCloseTo(700_000, 6);
    expect(scaleOf(view)).toBeCloseTo(900 / (430 * 365.2425), 4);
    expect(resizeView(view, 450)).toEqual({ ...view, width: 450 });
  });

  it('zooms about a point that stays put', () => {
    const view = years(gregorian, 1600, 2030);
    for (const x of [0, 137, 450, 900]) {
      const anchor = daysAt(view, x);
      const closer = zoomView(gregorian, view, 2, x);
      expect(closer.end - closer.start).toBeCloseTo((view.end - view.start) / 2, 6);
      expect(daysAt(closer, x)).toBeCloseTo(anchor, 6);
      const back = zoomView(gregorian, closer, 0.5, x);
      expect(back.start).toBeCloseTo(view.start, 6);
      expect(back.end).toBeCloseTo(view.end, 6);
    }
    expect(zoomView(gregorian, view, 0)).toBe(view);
    expect(zoomView(gregorian, view, NaN)).toBe(view);
  });

  it('stops at ten days and at all of time', () => {
    let view = years(gregorian, 1600, 2030);
    for (let i = 0; i < 60; i++) view = zoomView(gregorian, view, 3);
    expect(view.end - view.start).toBeCloseTo(MIN_VISIBLE_DAYS, 9);
    for (let i = 0; i < 80; i++) view = zoomView(gregorian, view, 1 / 3);
    const all = allTime(gregorian);
    expect(view.start).toBe(all.first);
    expect(view.end).toBe(all.last + 1);
    expect(panView(gregorian, view, 5000)).toEqual(view);
  });

  it('pans, and stops at the edges of time', () => {
    const view = years(gregorian, 1600, 2030);
    const later = panView(gregorian, view, 90);
    expect(later.start - view.start).toBeCloseTo((view.end - view.start) / 10, 6);
    expect(later.end - later.start).toBeCloseTo(view.end - view.start, 6);
    const all = allTime(gregorian);
    const edge = clampView(gregorian, { start: all.last - 10, end: all.last + 500, width: 900 });
    expect(edge.end).toBe(all.last + 1);
    expect(edge.end - edge.start).toBeCloseTo(510, 6);
  });

  it('fits a stretch of time with air on both sides', () => {
    const extent = { first: yearStart(gregorian, 1600), last: yearEnd(gregorian, 2029) };
    const view = fitView(gregorian, extent, 1000);
    expect(xOf(view, extent.first)).toBeCloseTo(1000 * (0.05 / 1.1), 6);
    expect(xOf(view, extent.last + 1)).toBeCloseTo(1000 * (1.05 / 1.1), 6);
    const point = fitView(gregorian, { first: 5, last: 5 }, 1000);
    expect(point.end - point.start).toBeCloseTo(MIN_VISIBLE_DAYS * 1.1, 6);
    expect(defaultView(selunnan, 800).width).toBe(800);
  });
});

describe('labels that fade', () => {
  it('rise smoothly from nothing to everything', () => {
    expect(tickOpacity(10, 56, 104)).toBe(0);
    expect(tickOpacity(56, 56, 104)).toBe(0);
    expect(tickOpacity(80, 56, 104)).toBeCloseTo(0.5, 9);
    expect(tickOpacity(104, 56, 104)).toBe(1);
    expect(tickOpacity(5000, 56, 104)).toBe(1);
    let last = 0;
    for (let px = 50; px <= 110; px += 0.5) {
      const now = tickOpacity(px, 56, 104);
      expect(now).toBeGreaterThanOrEqual(last);
      expect(now - last).toBeLessThan(0.02);
      last = now;
    }
  });

  it('uses steps that each divide the next', () => {
    expect(YEAR_STEPS.slice(0, 7)).toEqual([1, 5, 10, 50, 100, 500, 1000]);
    for (let i = 1; i < YEAR_STEPS.length; i++) expect(YEAR_STEPS[i]! % YEAR_STEPS[i - 1]!).toBe(0);
    expect(YEAR_STEPS.at(-1)).toBe(5e10);
    expect(yearStep(2.09)).toBe(50);
    expect(yearStep(200)).toBe(1);
    expect(yearStep(1e-12)).toBe(5e10);
  });

  it('draws the mock-up: 1600 to 2030 with a label every fifty years', () => {
    const view = years(gregorian, 1600, 2030);
    const found = ticks(gregorian, view);
    expect(found.map((tick) => tick.label)).toEqual(['1600', '1650', '1700', '1750', '1800', '1850', '1900', '1950', '2000']);
    for (const tick of found) {
      expect(tick.unit).toBe('year');
      expect(tick.opacity).toBe(1);
    }
    expect(found[1]!.x).toBeCloseTo((50 / 430) * 900, 0);
  });

  it('fades the next finer labels in as you zoom in, and never drops one', () => {
    let view = years(gregorian, 1600, 2030);
    let opacityOf1710 = 0;
    for (let i = 0; i < 40; i++) {
      const closer = zoomView(gregorian, view, 1.06, xOf(view, yearStart(gregorian, 1712)));
      const before = new Map(ticks(gregorian, view).map((tick) => [tick.days, tick]));
      const after = new Map(ticks(gregorian, closer).map((tick) => [tick.days, tick]));
      for (const [days, tick] of before) {
        if (days < closer.start || days > closer.end) continue;
        expect(after.get(days)!.opacity).toBeGreaterThanOrEqual(tick.opacity);
        expect(after.get(days)!.opacity - tick.opacity).toBeLessThan(0.2);
      }
      const now = after.get(yearStart(gregorian, 1710))?.opacity ?? 0;
      expect(now).toBeGreaterThanOrEqual(opacityOf1710);
      opacityOf1710 = now;
      view = closer;
    }
    expect(opacityOf1710).toBe(1);
  });

  it('counts both ways from year 1', () => {
    expect(solid(gregorian, years(gregorian, -299, 301))).toEqual(['300 BCE', '200 BCE', '100 BCE', '1 CE', '100 CE', '200 CE', '300 CE']);
    // The fifties are on their way in.
    expect(labels(gregorian, years(gregorian, -299, 301))).toContain('150 BCE');
    const found = ticks(gregorian, years(gregorian, -299, 301));
    expect(found.find((tick) => tick.label === '100 BCE')!.days).toBe(yearStart(gregorian, -99));
    expect(found.find((tick) => tick.label === '1 CE')!.days).toBe(0);
    // Year by year: 2 BCE, 1 BCE, 1 CE, 2 CE. There is no year nought.
    expect(labels(gregorian, years(gregorian, -1, 3))).toEqual(['2 BCE', '1 BCE', '1 CE', '2 CE', '3 CE']);
    // A calendar with no name for the time before runs straight through zero.
    expect(solid(kharan, years(kharan, -300, 301))).toEqual(['−300', '−200', '−100', '0', '100', '200', '300']);
  });

  it('shows months once they have room, and names a year where it starts', () => {
    const view = years(selunnan, 1020, 1021, 1200);
    const found = ticks(selunnan, view);
    expect(found.filter((tick) => tick.label !== '').map((tick) => tick.label)).toEqual(['1020', 'Tha', 'See', 'Rai', 'Blo', 'Sun', 'Hig', 'Rip', 'Har', 'Mis', 'Lea', 'Emb', 'Dar', '1021']);
    // Midyear Day gets a line and no name: it is one day wide.
    const midyear = found.find((tick) => tick.days === yearStart(selunnan, 1020) + 7 * 28)!;
    expect(midyear).toMatchObject({ unit: 'part', label: '' });
    expect(found.filter((tick) => tick.unit === 'part' && tick.label !== '').every((tick) => tick.opacity === 1)).toBe(true);
    // A little further out the months are half there.
    const far = ticks(selunnan, years(selunnan, 1019, 1021, 1200));
    const month = far.find((tick) => tick.label === 'Har')!;
    expect(month.opacity).toBeGreaterThan(0);
    expect(month.opacity).toBeLessThan(1);
  });

  it('shows days once they have room, and names a month where it starts', () => {
    const start = yearStart(selunnan, 1022) + 8 * 28 - 4;
    const found = ticks(selunnan, { start, end: start + 20, width: 1000 });
    expect(found.map((tick) => tick.label)).toEqual(['25', '26', '27', '28', 'Harvestmoon', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17']);
    expect(found.every((tick) => tick.opacity === 1)).toBe(true);
    const newYear = yearStart(kharan, 8) - 3;
    expect(ticks(kharan, { start: newYear, end: newYear + 12, width: 1000 }).map((tick) => tick.label)).toEqual(['40', '41', 'Duskturn', '8', 'Arrak', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('reaches back to the Big Bang', () => {
    const view = fitView(gregorian, { first: -BIG_BANG_DAYS, last: yearStart(gregorian, 2026) }, 1000);
    expect(solid(gregorian, view)).toEqual(['10 bn BCE', '5 bn BCE', '1 CE']);
    expect(labels(gregorian, view)).toContain('13 bn BCE');
    const closer = zoomView(gregorian, view, 40, 0);
    expect(labels(gregorian, closer)).toContain('14.4 bn BCE');
  });

  it.each(ENGINES)('%s: never draws too much, at any zoom', (_name, engine) => {
    const next = random(21);
    const all = allTime(engine);
    for (let i = 0; i < 400; i++) {
      const width = between(next, 280, 1600);
      const length = MIN_VISIBLE_DAYS * Math.pow((all.last - all.first) / MIN_VISIBLE_DAYS, next());
      const middle = i % 3 === 0 ? (next() - 0.5) * 2e6 : all.first + next() * (all.last - all.first);
      const view = clampView(engine, { start: middle - length / 2, end: middle + length / 2, width });
      const found = ticks(engine, view);
      // A view of a few months on a narrow screen can fall between two New Years; anything longer has ticks.
      if (view.end - view.start >= 2 * engine.meanYear) expect(found.length).toBeGreaterThan(0);
      expect(found.length).toBeLessThan(width / 8);
      let lastYearX = -Infinity;
      let lastX = -Infinity;
      for (const tick of found) {
        expect(tick.x).toBeGreaterThanOrEqual(-1e-6);
        expect(tick.x).toBeLessThanOrEqual(width + 1e-6);
        expect(tick.x).toBeGreaterThan(lastX);
        expect(tick.opacity).toBeGreaterThanOrEqual(0);
        expect(tick.opacity).toBeLessThanOrEqual(1);
        lastX = tick.x;
        if (tick.unit === 'year' && tick.label !== '') {
          // Labelled years keep their distance, but for "1" beside the last year before it.
          if (tick.days !== 0) expect(tick.x - lastYearX).toBeGreaterThan(50);
          lastYearX = tick.x;
        }
      }
      expect(viewLabel(engine, view).length).toBeGreaterThan(0);
    }
  });
});

describe('the view in words', () => {
  it('speaks of years, months or days as the zoom asks', () => {
    expect(viewLabel(gregorian, years(gregorian, 1600, 2030))).toBe('1600 – 2029 CE');
    expect(viewLabel(gregorian, years(gregorian, -299, 301))).toBe('300 BCE – 300 CE');
    expect(viewLabel(gregorian, years(gregorian, -299, -99))).toBe('300 – 101 BCE');
    expect(viewLabel(kharan, years(kharan, -300, 300))).toBe('−300 – 299 KY');
    expect(viewPrecision(selunnan, years(selunnan, 1020, 1022))).toBe('month');
    expect(viewLabel(selunnan, years(selunnan, 1020, 1022))).toBe('Frostmoon 1020 FS – Darkmoon 1021 FS');
    const start = yearStart(selunnan, 1022) + 8 * 28;
    expect(viewLabel(selunnan, { start, end: start + 17, width: 900 })).toBe('1 Harvestmoon 1022 FS – 17 Harvestmoon 1022 FS');
    expect(viewLabel(selunnan, { start, end: start + 28, width: 900 })).toBe('1 Harvestmoon 1022 FS – 28 Harvestmoon 1022 FS');
    const midyear = yearStart(selunnan, 1020) + 7 * 28;
    expect(viewLabel(selunnan, { start: midyear, end: midyear + 1, width: 900 })).toBe('Midyear Day 1020 FS');
  });
});
