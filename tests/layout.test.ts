import { describe, expect, it } from 'vitest';
import { EXAMPLES, exampleById } from '../src/content/examples';
import { allTime, clampView, fitView, MIN_VISIBLE_DAYS, xOf, zoomView, type View } from '../src/time/axis';
import { yearEnd, yearStart } from '../src/time/dates';
import { engineFor } from '../src/time/engine';
import { LAYOUT_DEFAULTS, extentOf, fitText, guessWidth, layoutTimeline, packRows } from '../src/time/layout';
import { emptyTimeline } from '../src/time/model';
import { normalizeTimeline } from '../src/time/normalize';
import { between, gregorian, random } from './helpers/engines';

const coast = exampleById('oriental-coast')!.timeline;
const fitted = (width = 1000): View => fitView(gregorian, extentOf(coast, gregorian)!, width);
const o = LAYOUT_DEFAULTS;

describe('rows', () => {
  it('keeps overlapping stretches apart and packs the rest together', () => {
    expect(packRows([])).toEqual([]);
    expect(packRows([{ first: 0, last: 10 }, { first: 11, last: 20 }, { first: 5, last: 30 }, { first: 31, last: 40 }])).toEqual([0, 0, 1, 0]);
    // Touching on the same day is overlapping.
    expect(packRows([{ first: 0, last: 10 }, { first: 10, last: 20 }])).toEqual([0, 1]);
    // An open end takes its row for good.
    expect(packRows([{ first: 0, last: Infinity }, { first: 100, last: 200 }, { first: 300, last: 400 }])).toEqual([0, 1, 1]);
    // Of two that start together the longer goes first.
    expect(packRows([{ first: 0, last: 5 }, { first: 0, last: 50 }])).toEqual([1, 0]);
  });

  it('cuts text to a width', () => {
    const measure = (text: string) => guessWidth(text, false);
    expect(fitText('Treaty of Selunna', 500, measure)).toBe('Treaty of Selunna');
    expect(fitText('Treaty of Selunna', 70, measure)).toBe('Treaty of…');
    expect(fitText('Treaty of Selunna', 20, measure)).toBe('');
    expect(fitText('', 20, measure)).toBe('');
    expect(measure(fitText('Kingdom of Ostaril · House Varenko', 150, measure))).toBeLessThanOrEqual(150);
  });
});

describe('the stretch a timeline covers', () => {
  it('runs from the earliest date to the latest', () => {
    expect(extentOf(emptyTimeline(), gregorian)).toBeNull();
    expect(extentOf(coast, gregorian)).toEqual({ first: yearStart(gregorian, 1600), last: yearEnd(gregorian, 1961) - 263 });
    const selunna = exampleById('selunna')!;
    const engine = engineFor(selunna.timeline.calendar);
    expect(extentOf(selunna.timeline, engine)).toEqual({ first: yearStart(engine, -399), last: yearEnd(engine, 961) - 9 * 28 });
  });
});

describe('the Oriental Coast, laid out', () => {
  const layout = layoutTimeline(coast, gregorian, fitted());

  it('puts eras on top, tracks below one another, and the axis last', () => {
    expect(layout.width).toBe(1000);
    expect(layout.eras.map((era) => [era.text, era.y, era.h])).toEqual([['Age of Sail', 0, 32], ['Industrial age', 0, 32], ['Modern era', 0, 32]]);
    expect(layout.eras[2]!.openEnd).toBe(true);
    expect(layout.eras[2]!.x + layout.eras[2]!.w).toBe(1000);
    let y = o.eraHeight;
    for (const track of layout.tracks) {
      expect(track.y).toBe(y);
      for (const item of [...track.spans, ...track.events]) {
        expect(item.y).toBeGreaterThanOrEqual(track.y + o.trackPad);
        expect(item.y + item.h).toBeLessThanOrEqual(track.y + track.height - o.trackPad + 0.001);
      }
      y += track.height;
    }
    expect(layout.axisY).toBe(y);
    expect(layout.height).toBe(y + o.axisHeight);
    expect(layout.tracks.map((track) => track.name)).toEqual(['Teland', 'Ostaril', 'Coastal League', 'Shared world']);
  });

  it('gives every span its label', () => {
    const spans = layout.tracks.flatMap((track) => track.spans);
    expect(spans.length).toBe(5);
    for (const span of spans) {
      expect(span.place, span.label).not.toBe('hidden');
      expect(span.text.length).toBeGreaterThan(0);
    }
    const war = layout.tracks[3]!.spans[0]!;
    expect(war).toMatchObject({ label: 'Continental War', place: 'after', text: 'Continental War' });
    expect(war.w).toBeLessThan(20);
    expect(layout.tracks[0]!.spans.map((span) => [span.label, span.row, span.ongoing, span.openEnd])).toEqual([
      ['House Delmaris', 0, false, false],
      ['Republic of Teland', 0, true, true],
    ]);
  });

  it('draws uncertain ends as such', () => {
    const ostaril = layout.tracks[1]!.spans[0]!;
    expect(ostaril.softStart).toBeGreaterThanOrEqual(8);
    expect(ostaril.softEnd).toBe(0);
    expect(layout.tracks[0]!.spans[0]!.softStart).toBe(0);
    const events = layout.tracks.flatMap((track) => track.events);
    expect(events.filter((event) => event.uncertain).map((event) => event.label).sort()).toEqual(['A comet with three tails', 'Port Delmar is founded', 'The League quietly dissolves', 'Vasil I is crowned']);
    const comet = events.find((event) => event.label === 'A comet with three tails')!;
    expect(comet.from).toBeCloseTo(xOf(fitted(), yearStart(gregorian, 1701)), 6);
    expect(comet.to).toBeCloseTo(xOf(fitted(), yearStart(gregorian, 1801)), 6);
    expect(comet.x).toBeCloseTo((comet.from + comet.to) / 2, 6);
    const flight = events.find((event) => event.label === 'First orbital flight')!;
    expect(flight.to - flight.from).toBeLessThan(1);
  });

  it('lets event labels give way, never the markers', () => {
    for (const width of [320, 600, 1000, 1600]) {
      const narrow = layoutTimeline(coast, gregorian, fitted(width));
      for (const track of narrow.tracks) {
        expect(track.events.length).toBe(coast.tracks[track.index]!.events.length);
        for (let row = 0; row < o.eventRows; row++) {
          const inRow = track.events.filter((event) => event.row === row);
          inRow.forEach((event, i) => {
            const next = inRow[i + 1];
            if (next === undefined || event.text === '') return;
            const end = event.x + o.marker / 2 + o.labelGap + guessWidth(event.text, false);
            expect(end, `${event.label} at ${width}`).toBeLessThanOrEqual(next.x - o.marker / 2 - o.labelGap + 0.001);
          });
        }
      }
    }
    const wide = layoutTimeline(coast, gregorian, fitted(1600));
    expect(wide.tracks.flatMap((track) => track.events).filter((event) => event.text !== event.label).map((event) => event.label)).toEqual([]);
  });

  it('keeps spans on their rows while zooming', () => {
    const rows = (view: View) => layoutTimeline(coast, gregorian, view).tracks.flatMap((track) => track.spans.map((span) => `${span.label}:${span.row}`)).sort();
    const all = rows(fitted());
    const closer = zoomView(gregorian, fitted(), 6, 520);
    for (const row of rows(closer)) expect(all).toContain(row);
  });

  it('clips what runs off the edges', () => {
    const inside: View = { start: yearStart(gregorian, 1700), end: yearStart(gregorian, 1750), width: 800 };
    const laid = layoutTimeline(coast, gregorian, inside);
    expect(laid.tracks[0]!.spans).toHaveLength(1);
    expect(laid.tracks[0]!.spans[0]).toMatchObject({ label: 'House Delmaris', x: 0, w: 800, openStart: true, openEnd: true, place: 'inside', softStart: 0 });
    expect(laid.eras).toHaveLength(1);
    expect(laid.eras[0]).toMatchObject({ text: 'Age of Sail', x: 0, w: 800, openStart: true, openEnd: true });
    expect(laid.tracks[0]!.events).toEqual([]);
    expect(laid.tracks[3]!.events.map((event) => event.label)).toEqual(['A comet with three tails']);
    // A track keeps its height when nothing in it shows.
    expect(laid.tracks.map((track) => track.height)).toEqual(layout.tracks.map((track) => track.height));
  });

  it('puts overlapping spans and eras on rows of their own', () => {
    const { timeline } = normalizeTimeline({
      eras: [{ label: 'One', from: '1', to: '100' }, { label: 'Two', from: '50', to: '150' }],
      tracks: [
        { name: 'Busy', spans: [{ label: 'A', from: '1', to: '100' }, { label: 'B', from: '50', to: '150' }, { label: 'C', from: '120', to: '130' }, { label: 'D', from: '101', to: '110' }] },
        { name: 'Empty' },
        { name: 'Only events', events: [{ title: 'E', date: '75' }] },
      ],
    });
    const laid = layoutTimeline(timeline, gregorian, fitView(gregorian, extentOf(timeline, gregorian)!, 900));
    expect(laid.eras.map((era) => era.y)).toEqual([0, o.eraHeight]);
    expect(laid.tracks[0]!.y).toBe(2 * o.eraHeight);
    const busy = Object.fromEntries(laid.tracks[0]!.spans.map((span) => [span.label, span.row]));
    expect(busy).toEqual({ A: 0, B: 1, C: 0, D: 0 });
    expect(laid.tracks[0]!.height).toBe(2 * o.trackPad + 2 * o.spanHeight + o.rowGap);
    expect(laid.tracks[1]!.height).toBe(2 * o.trackPad + o.eventHeight);
    expect(laid.tracks[2]!.height).toBe(2 * o.trackPad + o.eventHeight);
  });
});

describe('every example, at any zoom', () => {
  it.each(EXAMPLES.map((example) => [example.id, example] as const))('%s: stays inside the view and makes sense', (_id, example) => {
    const engine = engineFor(example.timeline.calendar);
    const extent = extentOf(example.timeline, engine)!;
    const next = random(31);
    for (let i = 0; i < 300; i++) {
      const width = between(next, 280, 1600);
      const all = allTime(engine);
      const length = MIN_VISIBLE_DAYS * Math.pow((all.last - all.first) / MIN_VISIBLE_DAYS, next() * 0.8);
      const middle = extent.first + next() * (extent.last - extent.first);
      const view = clampView(engine, { start: middle - length / 2, end: middle + length / 2, width });
      const laid = layoutTimeline(example.timeline, engine, view);
      expect(laid.tracks.length).toBe(example.timeline.tracks.length);
      for (const box of [...laid.eras, ...laid.tracks.flatMap((track) => track.spans)]) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.w).toBeLessThanOrEqual(width + 2);
        expect(box.w).toBeGreaterThanOrEqual(2);
        expect(Number.isFinite(box.y)).toBe(true);
        expect(box.label.startsWith(box.text.replace('…', ''))).toBe(true);
      }
      for (const span of laid.tracks.flatMap((track) => track.spans)) {
        expect(span.softStart + span.softEnd).toBeLessThanOrEqual(span.w + 0.001);
        if (span.place === 'inside') expect(guessWidth(span.text, true)).toBeLessThanOrEqual(Math.max(0, span.w - 2 * o.barPad) + 0.001);
        if (span.place === 'hidden') expect(span.text).toBe('');
      }
      for (const event of laid.tracks.flatMap((track) => track.events)) {
        expect(event.x).toBeGreaterThanOrEqual(-o.marker);
        expect(event.x).toBeLessThanOrEqual(width + o.marker);
        expect(event.to).toBeGreaterThanOrEqual(event.from);
        expect(event.row).toBeLessThan(o.eventRows);
      }
    }
  });
});
