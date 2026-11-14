import { describe, expect, it } from 'vitest';
import { EXAMPLES, exampleById } from '../src/content/examples';
import { KHARAN, SELUNNAN } from '../src/content/calendars';
import { engineFor } from '../src/time/engine';
import { encodeDate, formatDate } from '../src/time/fuzzy';
import { canRedo, canUndo, HISTORY_DEPTH, record, redo, startHistory, undo } from '../src/time/history';
import { LIMITS, countItems, emptyTimeline, getItem, sameRef, titleOf, type Timeline } from '../src/time/model';
import { cleanText, cleanUrl, normalizeTimeline } from '../src/time/normalize';
import { addEra, addEvent, addSpan, addTrack, appendTracks, moveItem, moveTrack, removeItem, removeTrack, setCalendar, setTitle, updateItem, updateTrack } from '../src/time/ops';

const coast = exampleById('oriental-coast')!.timeline;
const selunna = exampleById('selunna')!.timeline;

describe('the examples', () => {
  it('are three clean timelines in three calendars', () => {
    expect(EXAMPLES.map((example) => example.id)).toEqual(['oriental-coast', 'selunna', 'khara']);
    expect(new Set(EXAMPLES.map((example) => engineFor(example.timeline.calendar).name)).size).toBe(3);
    for (const example of EXAMPLES) {
      const again = normalizeTimeline(JSON.parse(JSON.stringify(example.timeline)));
      expect(again.issues).toEqual([]);
      expect(again.timeline).toEqual(example.timeline);
      expect(engineFor(example.timeline.calendar).name).toBe(example.calendarName);
      const count = countItems(example.timeline);
      expect(count.tracks).toBeGreaterThanOrEqual(3);
      expect(count.spans).toBeGreaterThanOrEqual(3);
      expect(count.events).toBeGreaterThanOrEqual(7);
      expect(count.eras).toBeGreaterThanOrEqual(3);
    }
  });

  it('hold dates of every kind', () => {
    const kinds = new Set<string>();
    for (const example of EXAMPLES) {
      for (const track of example.timeline.tracks) {
        for (const event of track.events) kinds.add(encodeDate(event.date).replace(/^(~?)-?\d+/, '$1n').replace(/\d+/g, 'n'));
      }
    }
    for (const kind of ['n', '~n', 'n-n', 'n-n-n', 'n-in-n', 'nD', 'nC']) expect(kinds, kind).toContain(kind);
  });
});

describe('a timeline from anywhere', () => {
  it('starts an empty one from nothing', () => {
    for (const junk of [null, undefined, 7, 'timeline', [], () => 1]) {
      const { timeline, issues } = normalizeTimeline(junk);
      expect(timeline).toEqual(emptyTimeline());
      expect(issues.length).toBe(1);
    }
    expect(normalizeTimeline({})).toEqual({ timeline: emptyTimeline(), issues: [] });
  });

  it('cleans texts, dates, links and tones', () => {
    const { timeline, issues } = normalizeTimeline({
      title: `  History\n of\tKhara ${'x'.repeat(200)}`,
      calendar: KHARAN,
      eras: [{ label: '', from: '1' }, { label: 'No date' }, 'junk'],
      tracks: [
        {
          name: '',
          kind: 'empire',
          spans: [
            { label: 'Backwards', from: '300', to: '200', tone: 99 },
            { label: 'Open', from: '5-11-1', to: 'whenever', tone: 5 },
            { label: 'No start', to: '5' },
          ],
          events: [
            { title: '<b>Bold</b>', date: '7-10-42', text: 'a\u0007b', links: ['https://eurth.org/a', { url: 'http://eurth.org' }, { url: 'javascript:alert(1)' }, { label: 'Wiki', url: 'https://www.example.org/wiki?x=1' }] },
            { title: 'Too many links', date: '8', links: Array.from({ length: 6 }, (_, i) => ({ url: `https://eurth.org/${i}` })) },
            { title: 'Lost', date: 'tomorrow' },
            null,
          ],
        },
        'not a track',
      ],
    });
    expect(timeline.title.length).toBe(LIMITS.title);
    expect(timeline.title.startsWith('History of Khara x')).toBe(true);
    expect(timeline.eras).toEqual([{ label: 'Era', from: { year: 1 }, to: null }]);
    const track = timeline.tracks[0]!;
    expect(timeline.tracks.length).toBe(1);
    expect(track.name).toBe('Track 1');
    expect(track.kind).toBe('nation');
    expect(track.spans.map((span) => [span.label, encodeDate(span.from), span.to === null ? null : encodeDate(span.to), span.tone])).toEqual([
      ['Backwards', '200', '300', 0],
      ['Open', '5', null, 5],
    ]);
    // Year 7 is no leap year: day 42 of the last month becomes day 41.
    expect(track.events.map((event) => [event.title, encodeDate(event.date)])).toEqual([
      ['<b>Bold</b>', '7-10-41'],
      ['Too many links', '8'],
    ]);
    expect(track.events[0]!.text).toBe('a b');
    expect(track.events[0]!.links).toEqual([
      { label: 'eurth.org', url: 'https://eurth.org/a' },
      { label: 'Wiki', url: 'https://www.example.org/wiki?x=1' },
    ]);
    expect(track.events[1]!.links.length).toBe(LIMITS.links);
    expect(issues.length).toBeGreaterThanOrEqual(10);
    for (const issue of issues) expect(issue.message).toMatch(/^[A-Z].*\.$/);
    // Clean once, clean for good.
    expect(normalizeTimeline(timeline)).toEqual({ timeline, issues: [] });
  });

  it('keeps to the limits', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `E${i}`, label: `S${i}`, date: String(i + 1), from: String(i + 1) }));
    const { timeline, issues } = normalizeTimeline({
      eras: many(LIMITS.eras + 5),
      tracks: [...Array.from({ length: 6 }, () => ({ spans: many(LIMITS.spans + 10), events: many(LIMITS.events + 10) })), ...Array.from({ length: LIMITS.tracks }, () => ({}))],
    });
    const count = countItems(timeline);
    expect(count.eras).toBe(LIMITS.eras);
    expect(count.tracks).toBe(LIMITS.tracks);
    expect(timeline.tracks[0]!.spans.length).toBe(LIMITS.spans);
    expect(timeline.tracks[0]!.events.length).toBe(LIMITS.events);
    expect(count.spans + count.events).toBe(LIMITS.items);
    expect(issues.map((issue) => issue.path).sort()).toEqual(['eras', 'tracks', 'tracks']);
  });

  it('falls back to Gregorian when the calendar is unusable', () => {
    const loop: Record<string, unknown> = { months: [{ name: 'A', days: 3 }] };
    loop.self = loop;
    for (const calendar of [{ months: [] }, 'selunnan', loop, { months: [{ name: 'A', days: 3 }], padding: 'x'.repeat(LIMITS.calendar) }]) {
      const { timeline, issues } = normalizeTimeline({ calendar, tracks: [{ events: [{ title: 'E', date: '2020-2-30' }] }] });
      expect(timeline.calendar).toBeNull();
      expect(issues[0]!.path).toBe('calendar');
      expect(encodeDate(timeline.tracks[0]!.events[0]!.date)).toBe('2020-2-29');
    }
  });

  it('never throws, whatever it is fed', () => {
    const junk: unknown[] = [null, 0, -1, 1.5, NaN, '', 'x', [], {}, [[]], { year: 1 }, { length: 5 }, true, '1650', { tracks: 1 }, { spans: {} }];
    for (const a of junk) {
      for (const b of junk) {
        const input = { title: a, calendar: b, eras: [a, { label: b, from: a, to: b }], tracks: [a, { name: a, kind: b, spans: [b, { label: a, from: b, to: a, tone: b, links: a }], events: [{ title: b, date: a, text: b, links: [a, b] }] }] };
        const { timeline } = normalizeTimeline(input);
        expect(normalizeTimeline(timeline).issues).toEqual([]);
      }
    }
  });

  it('cleans single values', () => {
    expect(cleanText('  two   words ', 80)).toBe('two words');
    expect(cleanText('abc', 2)).toBe('ab');
    expect(cleanText('ab cd', 3)).toBe('ab');
    expect(cleanText(12, 80)).toBe('');
    expect(cleanUrl('https://eurth.org/forum?x=1#top')).toBe('https://eurth.org/forum?x=1#top');
    for (const bad of ['http://eurth.org', 'https://', 'https://eurth.org/a b', 'ftp://x', 'HTTPS://eurth.org', `https://eurth.org/${'a'.repeat(4000)}`, null, 5]) expect(cleanUrl(bad), String(bad)).toBeNull();
  });
});

describe('changing a timeline', () => {
  it('never changes the timeline it is given', () => {
    const before = JSON.stringify(coast);
    let t = setTitle(coast, 'A new title');
    t = addTrack(t, 'Fourth power', 'nation');
    t = addEvent(t, 0, { title: 'Something', date: { year: 1700 } }).timeline;
    t = addSpan(t, 0, { label: 'A span', from: { year: 1700 }, to: { year: 1710 } }).timeline;
    t = updateItem(t, { kind: 'event', track: 0, index: 0 }, { title: 'Renamed' });
    t = removeItem(t, { kind: 'span', track: 0, index: 0 });
    t = moveTrack(t, 0, 2);
    t = removeTrack(t, 1);
    expect(JSON.stringify(coast)).toBe(before);
    expect(t.title).toBe('A new title');
    expect(normalizeTimeline(t).issues).toEqual([]);
  });

  it('adds, renames, moves and removes tracks', () => {
    let t = addTrack(emptyTimeline(), 'Teland');
    t = addTrack(t, '', 'world');
    t = addTrack(t, 'Ostaril', 'dynasty');
    expect(t.tracks.map((track) => [track.name, track.kind])).toEqual([['Teland', 'nation'], ['Track 2', 'world'], ['Ostaril', 'dynasty']]);
    t = updateTrack(t, 1, { name: 'Shared world' });
    t = moveTrack(t, 2, 0);
    expect(t.tracks.map((track) => track.name)).toEqual(['Ostaril', 'Teland', 'Shared world']);
    expect(moveTrack(t, 0, 9)).toBe(t);
    expect(moveTrack(t, 5, 0)).toBe(t);
    expect(updateTrack(t, 9, { name: 'x' })).toBe(t);
    expect(removeTrack(t, 9)).toBe(t);
    t = removeTrack(t, 1);
    expect(t.tracks.map((track) => track.name)).toEqual(['Ostaril', 'Shared world']);
    let full = emptyTimeline();
    for (let i = 0; i < LIMITS.tracks + 3; i++) full = addTrack(full);
    expect(full.tracks.length).toBe(LIMITS.tracks);
    expect(appendTracks(t, coast.tracks).tracks.length).toBe(2 + coast.tracks.length);
  });

  it('adds spans, events and eras, and says where they went', () => {
    let t = addTrack(emptyTimeline(), 'Teland');
    const span = addSpan(t, 0, { label: 'House Delmaris', from: { year: 1622 }, to: { year: 1870 } });
    expect(span.ref).toEqual({ kind: 'span', track: 0, index: 0 });
    t = span.timeline;
    const open = addSpan(t, 0, { label: 'Republic', from: { year: 1871 } });
    t = open.timeline;
    expect(getItem(t, open.ref!)).toMatchObject({ label: 'Republic', to: null, tone: 1, text: '', links: [] });
    const event = addEvent(t, 0, { title: 'The Lantern Revolt', date: { year: 1869, month: 3, day: 18 }, text: 'By lantern light.' });
    t = event.timeline;
    expect(titleOf(getItem(t, event.ref!)!)).toBe('The Lantern Revolt');
    const era = addEra(t, { label: 'Age of Sail', from: { year: 1600 }, to: { year: 1820 } });
    t = era.timeline;
    expect(era.ref).toEqual({ kind: 'era', index: 0 });
    expect(countItems(t)).toEqual({ tracks: 1, spans: 2, events: 1, eras: 1 });
    // No such track, and no usable date: nothing happens.
    expect(addSpan(t, 4, { label: 'x', from: { year: 1 } })).toEqual({ timeline: t, ref: null });
    expect(addEvent(t, 0, { title: 'x', date: { year: 1.5 } })).toEqual({ timeline: t, ref: null });
    expect(addEra(t, { label: 'x', from: {} as never })).toEqual({ timeline: t, ref: null });
  });

  it('changes and removes things', () => {
    const ref = { kind: 'event', track: 2, index: 1 } as const;
    let t = updateItem(coast, ref, { date: { year: 1790, month: 2, day: 30 }, text: 'Signed late.' });
    expect(getItem(t, ref)).toMatchObject({ title: 'Treaty of Selunna', date: { year: 1790, month: 2, day: 28 }, text: 'Signed late.' });
    expect(updateItem(coast, ref, { date: 'never' as never })).toBe(coast);
    expect(updateItem(coast, { kind: 'event', track: 2, index: 99 }, { title: 'x' })).toBe(coast);
    t = updateItem(coast, { kind: 'span', track: 0, index: 1 }, { to: { year: 2001 } });
    expect(encodeDate(t.tracks[0]!.spans[1]!.to!)).toBe('2001');
    t = updateItem(coast, { kind: 'era', index: 0 }, { label: 'Age of sail and salt' });
    expect(t.eras[0]!.label).toBe('Age of sail and salt');
    t = removeItem(coast, ref);
    expect(t.tracks[2]!.events.map((event) => event.title)).not.toContain('Treaty of Selunna');
    expect(removeItem(coast, { kind: 'era', index: 1 }).eras.length).toBe(coast.eras.length - 1);
    expect(removeItem(coast, { kind: 'span', track: 9, index: 0 })).toBe(coast);
    expect(removeItem(coast, { kind: 'era', index: 9 })).toBe(coast);
  });

  it('moves a thing to another track', () => {
    const ref = { kind: 'event', track: 2, index: 1 } as const;
    const moved = moveItem(coast, ref, 0);
    expect(moved.ref).toEqual({ kind: 'event', track: 0, index: coast.tracks[0]!.events.length });
    expect(titleOf(getItem(moved.timeline, moved.ref)!)).toBe('Treaty of Selunna');
    expect(countItems(moved.timeline)).toEqual(countItems(coast));
    expect(moveItem(coast, ref, 2).timeline).toBe(coast);
    expect(moveItem(coast, ref, 9).timeline).toBe(coast);
    expect(moveItem(coast, { kind: 'era', index: 0 }, 1).timeline).toBe(coast);
  });

  it('puts a timeline in another calendar, keeping the numbers', () => {
    const { timeline, issues } = setCalendar(selunna, null);
    expect(timeline.calendar).toBeNull();
    // Month 13 and the Midyear Day do not exist in the Gregorian calendar.
    expect(issues.length).toBeGreaterThan(0);
    expect(formatDate(engineFor(null), timeline.tracks[0]!.events[0]!.date)).toBe('1 January 1 CE');
    expect(encodeDate(timeline.tracks[0]!.events[1]!.date)).toBe('5');
    const back = setCalendar(coast, SELUNNAN);
    expect(engineFor(back.timeline.calendar).name).toBe('Selunnan Reckoning');
    expect(formatDate(engineFor(back.timeline.calendar), back.timeline.tracks[0]!.events[1]!.date)).toBe('18 Seedmoon 1869 FS');
  });

  it('tells two things apart', () => {
    expect(sameRef({ kind: 'era', index: 1 }, { kind: 'era', index: 1 })).toBe(true);
    expect(sameRef({ kind: 'span', track: 0, index: 1 }, { kind: 'span', track: 1, index: 1 })).toBe(false);
    expect(sameRef({ kind: 'span', track: 0, index: 1 }, { kind: 'event', track: 0, index: 1 })).toBe(false);
    expect(sameRef(null, null)).toBe(true);
    expect(sameRef(null, { kind: 'era', index: 0 })).toBe(false);
    expect(getItem(coast, { kind: 'span', track: 7, index: 0 })).toBeNull();
  });
});

describe('undo and redo', () => {
  it('steps back and forward through timelines', () => {
    const a: Timeline = emptyTimeline();
    const b = setTitle(a, 'B');
    const c = setTitle(b, 'C');
    let history = startHistory(a);
    expect(canUndo(history)).toBe(false);
    expect(undo(history)).toBe(history);
    history = record(record(history, b), c);
    expect(record(history, c)).toBe(history);
    history = undo(history);
    expect(history.present).toBe(b);
    expect(canRedo(history)).toBe(true);
    history = redo(history);
    expect(history.present).toBe(c);
    expect(redo(history)).toBe(history);
    history = record(undo(undo(history)), c);
    expect(history.present).toBe(c);
    expect(canRedo(history)).toBe(false);
    expect(history.past).toEqual([a]);
  });

  it('forgets the oldest steps', () => {
    let history = startHistory(0);
    for (let i = 1; i <= HISTORY_DEPTH + 50; i++) history = record(history, i);
    expect(history.past.length).toBe(HISTORY_DEPTH);
    expect(history.past[0]).toBe(50);
  });
});
