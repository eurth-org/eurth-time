import { describe, expect, it } from 'vitest';
import { EXAMPLES, exampleById } from '../src/content/examples';
import { fitView, xOf, type View } from '../src/time/axis';
import { yearStart } from '../src/time/dates';
import { engineFor } from '../src/time/engine';
import { countLine, describeItem, describeTimeline, descriptionText, formatDuration, formatStretch, itemLine, stretchDuration } from '../src/time/describe';
import { extentOf } from '../src/time/layout';
import { countItems, emptyTimeline, titleOf, getItem, type Ref } from '../src/time/model';
import { KEY_HELP, ZOOM_STEP, keyAction, move, navOrder, revealView } from '../src/time/nav';
import { addTrack } from '../src/time/ops';
import { gregorian, kharan, selunnan } from './helpers/engines';

const coast = exampleById('oriental-coast')!.timeline;
const selunna = exampleById('selunna')!.timeline;

describe('lengths of time', () => {
  it('speaks in the calendar’s own years, months and days', () => {
    expect(formatDuration(gregorian, 0)).toBe('0 days');
    expect(formatDuration(gregorian, 1)).toBe('1 day');
    expect(formatDuration(gregorian, 16)).toBe('16 days');
    expect(formatDuration(gregorian, 139)).toBe('5 months');
    expect(formatDuration(gregorian, 365)).toBe('1 year');
    expect(formatDuration(gregorian, 248 * 365.2425)).toBe('248 years');
    expect(formatDuration(gregorian, 12_500 * 365.2425)).toBe('12,500 years');
    expect(formatDuration(gregorian, 2.5e6 * 365.2425)).toBe('2.5 million years');
    expect(formatDuration(gregorian, 13.787e9 * 365.2425)).toBe('13.79 billion years');
    // A Kharan year is 412 days and has ten months.
    expect(formatDuration(kharan, 412)).toBe('1 year');
    expect(formatDuration(kharan, 365)).toBe('9 months');
    expect(formatDuration(gregorian, -5)).toBe('0 days');
  });

  it('writes a stretch from one date to another', () => {
    expect(formatStretch(gregorian, { year: 1622 }, { year: 1870 })).toBe('1622 to 1870 CE');
    expect(formatStretch(gregorian, { year: -43 }, { year: 14 })).toBe('44 BCE to 14 CE');
    expect(formatStretch(gregorian, { year: -99 }, { year: -43 })).toBe('100 to 44 BCE');
    expect(formatStretch(gregorian, { year: 1871 }, null)).toBe('since 1871 CE');
    expect(formatStretch(gregorian, { year: 1640, circa: true }, { year: 1700 })).toBe('c. 1640 CE to 1700 CE');
    expect(formatStretch(selunnan, { year: 351, month: 10, day: 3 }, { year: 352, month: 2, day: 19 })).toBe('3 Mistmoon 351 FS to 19 Thawmoon 352 FS');
    expect(formatStretch(kharan, { year: 40 }, { year: 187 })).toBe('40 to 187 KY');
    expect(formatStretch(gregorian, { year: 1914 }, { year: 1914 })).toBe('1914 CE');
  });

  it('says how long a stretch lasted', () => {
    expect(stretchDuration(gregorian, { year: 1622 }, { year: 1870 })).toBe('248 years');
    expect(stretchDuration(gregorian, { year: 1914 }, { year: 1919 })).toBe('5 years');
    expect(stretchDuration(gregorian, { year: 1871 }, null)).toBe('');
    expect(stretchDuration(selunnan, { year: 351, month: 10, day: 3 }, { year: 352, month: 2, day: 3 })).toBe('5 months');
    expect(stretchDuration(selunnan, { year: 140, circa: true }, { year: 146, circa: true })).toBe('about 6 years');
    expect(stretchDuration(gregorian, { year: 2020, month: 3, day: 1 }, { year: 2020, month: 3, day: 17 })).toBe('16 days');
  });
});

describe('the timeline in words', () => {
  it('sums up the whole in a sentence', () => {
    expect(describeTimeline(coast, gregorian).summary).toBe('A timeline from 1600 CE to 1961 CE, dated in the Gregorian calendar, with 4 tracks, 5 spans, 13 events and 3 eras.');
    expect(describeTimeline(selunna, engineFor(selunna.calendar)).summary).toBe(
      'A timeline from 400 Before the Founding to 961 FS, dated in the Selunnan Reckoning, with 3 tracks, 7 spans, 9 events and 4 eras.',
    );
    expect(describeTimeline(emptyTimeline(), gregorian)).toMatchObject({ title: 'Untitled timeline', summary: 'An empty timeline.', eras: [], tracks: [] });
    expect(describeTimeline(addTrack(emptyTimeline(), 'Teland'), gregorian).summary).toBe('A timeline with 1 track and nothing on it yet.');
    expect(countLine(addTrack(emptyTimeline(), 'Teland'))).toBe('1 track');
  });

  it('tells each track in the order things happened', () => {
    const teland = describeTimeline(coast, gregorian).tracks[0]!;
    expect(teland.items.map(itemLine)).toEqual([
      // Of a span and an event that start together, the span comes first: it is the setting.
      '1622 to 1870 CE: House Delmaris (248 years). Merchant-princes who ran Teland like a counting house: profitably, and with very little patience for poetry.',
      'c. 1622 CE: Port Delmar is founded. A trading post on the river mouth. The exact year was lost with the first harbour ledger.',
      '18 March 1869 CE: The Lantern Revolt. Dock workers march on the palace by lantern light. Eleven days later the prince agrees to an assembly.',
      'since 1871 CE: Republic of Teland. Proclaimed after the Lantern Revolt. The last Delmaris left by the harbour gate with the silver and, it is said, the good chairs.',
      '9 January 1871 CE: The first Assembly sits. Two hundred and four members, one of whom is still remembered for sleeping through the oath.',
      '1923 CE: Every adult gets the vote',
    ]);
  });

  it('leaves nothing out', () => {
    for (const example of EXAMPLES) {
      const engine = engineFor(example.timeline.calendar);
      const described = describeTimeline(example.timeline, engine);
      const count = countItems(example.timeline);
      expect(described.eras.length).toBe(count.eras);
      expect(described.tracks.reduce((sum, track) => sum + track.items.length, 0)).toBe(count.spans + count.events);
      const text = descriptionText(described);
      expect(text.startsWith(`${example.timeline.title}\nA timeline from `)).toBe(true);
      for (const track of example.timeline.tracks) {
        expect(text).toContain(`\n\n${track.name}\n- `);
        for (const item of [...track.spans, ...track.events]) {
          expect(text).toContain(titleOf(item));
          if (item.text !== '') expect(text).toContain(item.text);
        }
      }
      for (const era of example.timeline.eras) expect(text).toContain(era.label);
      for (const track of described.tracks) {
        for (let i = 1; i < track.items.length; i++) expect(track.items[i]!.first).toBeGreaterThanOrEqual(track.items[i - 1]!.first);
      }
      expect(text).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  it('says uncertain dates as such', () => {
    const text = descriptionText(describeTimeline(selunna, engineFor(selunna.calendar)));
    expect(text).toContain('- c. 140 FS to c. 146 FS: The Long Winter (about 6 years). Six hard years, give or take one at either end.');
    expect(text).toContain('- 590s FS: The Red Tide.');
    expect(text).toContain('- 4th century Before the Founding: Standing stones are raised in the Selun valley.');
    expect(text).toContain('- Midyear Day 5 FS: The first Midyear Day is kept.');
    expect(text).toContain('- 389 FS to c. 420 FS: Edric the Builder (about 31 years).');
    expect(text).toContain('Eras\n- 400 to 1 Before the Founding: Before the Founding (399 years)\n- 1 to 312 FS: The Compact (311 years)');
  });

  it('describes one thing for its card', () => {
    const treaty: Ref = { kind: 'event', track: 2, index: 1 };
    expect(describeItem(coast, gregorian, treaty)).toMatchObject({
      kind: 'event',
      when: '1789 CE',
      title: 'Treaty of Selunna',
      duration: '',
      text: 'Ends the Coastal War. Teland cedes the Ostaril isles; the League gains free passage through the straits.',
      links: [{ label: 'Eurth forums', url: 'https://eurth.org/' }],
    });
    expect(describeItem(coast, gregorian, { kind: 'span', track: 2, index: 0 })).toMatchObject({ when: '1702 to 1789 CE', title: 'Coastal War era', duration: '87 years' });
    expect(describeItem(coast, gregorian, { kind: 'era', index: 2 })).toMatchObject({ kind: 'era', when: 'since 1914 CE', title: 'Modern era', duration: '' });
    expect(describeItem(coast, gregorian, { kind: 'era', index: 9 })).toBeNull();
    expect(describeItem(coast, gregorian, { kind: 'span', track: 9, index: 0 })).toBeNull();
    expect(describeItem(coast, gregorian, { kind: 'event', track: 0, index: 99 })).toBeNull();
  });
});

describe('moving with the keyboard', () => {
  const order = navOrder(coast, gregorian);
  const title = (ref: Ref | null) => (ref === null ? null : titleOf(getItem(coast, ref)!));

  it('lists everything in the order it happened', () => {
    const count = countItems(coast);
    expect(order.length).toBe(count.eras + count.spans + count.events);
    for (let i = 1; i < order.length; i++) expect(order[i]!.first).toBeGreaterThanOrEqual(order[i - 1]!.first);
    expect(title(order[0]!.ref)).toBe('Age of Sail');
    expect(title(order.at(-1)!.ref)).toBe('First orbital flight');
    expect(navOrder(emptyTimeline(), gregorian)).toEqual([]);
  });

  it('starts somewhere from nowhere', () => {
    expect(title(move(order, null, 'right'))).toBe('Age of Sail');
    expect(title(move(order, null, 'next'))).toBe('Age of Sail');
    expect(title(move(order, null, 'previous'))).toBe('First orbital flight');
    expect(title(move(order, null, 'last'))).toBe('First orbital flight');
    expect(move([], null, 'next')).toBeNull();
    expect(title(move(order, { kind: 'event', track: 9, index: 9 }, 'down'))).toBe('Age of Sail');
  });

  it('walks a track with left and right, and stops at its ends', () => {
    let at: Ref | null = { kind: 'span', track: 0, index: 0 };
    const walked: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      at = move(order, at, 'right');
      walked.push(title(at));
    }
    expect(walked).toEqual(['Port Delmar is founded', 'The Lantern Revolt', 'Republic of Teland', 'The first Assembly sits', 'Every adult gets the vote', 'Every adult gets the vote', 'Every adult gets the vote']);
    expect(title(move(order, { kind: 'event', track: 0, index: 0 }, 'left'))).toBe('House Delmaris');
    expect(title(move(order, { kind: 'span', track: 0, index: 0 }, 'left'))).toBe('House Delmaris');
    expect(title(move(order, { kind: 'era', index: 0 }, 'right'))).toBe('Industrial age');
  });

  it('goes to the nearest thing in time on the next track with up and down', () => {
    const treaty: Ref = { kind: 'event', track: 2, index: 1 };
    // 1789: Ostaril's kingdom is going on (so it is the nearest), and the Great Famine of 1846 is the closest on the shared track.
    expect(title(move(order, treaty, 'up'))).toBe('Kingdom of Ostaril · House Varenko');
    expect(title(move(order, treaty, 'down'))).toBe('A comet with three tails');
    expect(title(move(order, { kind: 'event', track: 3, index: 2 }, 'down'))).toBe('First orbital flight');
    expect(title(move(order, { kind: 'span', track: 0, index: 0 }, 'up'))).toBe('Age of Sail');
    expect(title(move(order, { kind: 'era', index: 1 }, 'up'))).toBe('Industrial age');
    expect(title(move(order, { kind: 'era', index: 1 }, 'down'))).toBe('House Delmaris');
  });

  it('steps through everything with next and previous', () => {
    let at: Ref | null = move(order, null, 'first');
    const seen = new Set<string>();
    for (let i = 0; i < order.length + 3; i++) {
      seen.add(JSON.stringify(at));
      at = move(order, at, 'next');
    }
    expect(seen.size).toBe(order.length);
    expect(title(move(order, order[5]!.ref, 'previous'))).toBe(title(order[4]!.ref));
    expect(title(move(order, order[0]!.ref, 'previous'))).toBe(title(order[0]!.ref));
  });

  it('knows its keys, and leaves Tab alone', () => {
    expect(keyAction('ArrowRight')).toEqual({ type: 'move', how: 'right' });
    expect(keyAction('ArrowLeft', { shift: true })).toEqual({ type: 'pan', fraction: -0.2 });
    expect(keyAction('ArrowUp')).toEqual({ type: 'move', how: 'up' });
    expect(keyAction('Home')).toEqual({ type: 'move', how: 'first' });
    expect(keyAction('PageDown')).toEqual({ type: 'move', how: 'next' });
    expect(keyAction('+')).toEqual({ type: 'zoom', factor: ZOOM_STEP });
    expect(keyAction('=')).toEqual({ type: 'zoom', factor: ZOOM_STEP });
    expect(keyAction('-')).toEqual({ type: 'zoom', factor: 1 / ZOOM_STEP });
    expect(keyAction('0')).toEqual({ type: 'fit' });
    expect(keyAction('Enter')).toEqual({ type: 'open' });
    expect(keyAction(' ')).toEqual({ type: 'open' });
    expect(keyAction('Escape')).toEqual({ type: 'close' });
    for (const key of ['Tab', 'a', 'F5', 'Shift', '']) expect(keyAction(key)).toBeNull();
    expect(KEY_HELP.length).toBeGreaterThanOrEqual(8);
  });

  it('slides the view to show what is selected, without zooming', () => {
    const view: View = { start: yearStart(gregorian, 1700), end: yearStart(gregorian, 1800), width: 1000 };
    const inside = { first: yearStart(gregorian, 1750), last: yearStart(gregorian, 1751) };
    expect(revealView(view, inside)).toBe(view);
    const later = { first: yearStart(gregorian, 1869), last: yearStart(gregorian, 1869) + 10 };
    const moved = revealView(view, later);
    expect(moved.end - moved.start).toBeCloseTo(view.end - view.start, 6);
    expect(xOf(moved, later.last + 1)).toBeCloseTo(920, 3);
    const earlier = { first: yearStart(gregorian, 1622), last: yearStart(gregorian, 1623) };
    expect(xOf(revealView(view, earlier), earlier.first)).toBeCloseTo(80, 3);
    // Too long to fit: show where it starts.
    const long = { first: yearStart(gregorian, 1850), last: Infinity };
    expect(xOf(revealView(view, long), long.first)).toBeCloseTo(80, 3);
    // With everything in view there is nothing to slide for.
    const extent = extentOf(coast, gregorian)!;
    const whole = fitView(gregorian, extent, 1000);
    for (const item of order) expect(revealView(whole, { first: item.first, last: Math.min(item.last, extent.last) }, 0.04)).toBe(whole);
  });
});
