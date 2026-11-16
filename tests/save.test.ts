import { describe, expect, it } from 'vitest';
import { KHARAN, SELUNNAN } from '../src/content/calendars';
import { EXAMPLES, exampleById } from '../src/content/examples';
import { encodeCalendar, encodeJson, engineFor } from '../src/tool/engine';
import { encodeDate } from '../src/tool/fuzzy';
import { MAX_LINK_LENGTH, decodeTimeline, encodeTimeline, linkFits, timelineFromLink, timelineLink } from '../src/tool/link';
import { LIMITS, countItems, emptyTimeline } from '../src/tool/model';
import { normalizeTimeline } from '../src/tool/normalize';
import { calendarFromSection, fromProfileSection, readProfile, reignsFromDynasty, toProfileSection } from '../src/tool/profile';
import { gregorian, selunnan } from './helpers/engines';

const coast = exampleById('oriental-coast')!.timeline;
const selunna = exampleById('selunna')!.timeline;
const BASE = 'https://time.eurth.org/';

describe('a timeline in a link', () => {
  it.each(EXAMPLES.map((example) => [example.id, example] as const))('%s: comes back exactly as it went', (_id, example) => {
    const link = timelineLink(BASE, example.timeline);
    expect(link.startsWith(`${BASE}?t=1.`)).toBe(true);
    expect(link).toMatch(/^[!-~]+$/);
    expect(linkFits(link)).toBe(true);
    const read = timelineFromLink(link)!;
    expect(read.issues).toEqual([]);
    expect(read.timeline).toEqual(example.timeline);
    // The query string alone will do.
    expect(timelineFromLink(new URL(link).search)!.timeline).toEqual(example.timeline);
    expect(new URL(link).searchParams.has('cal')).toBe(example.timeline.calendar !== null);
  });

  it('is the plain address for an empty timeline', () => {
    expect(timelineLink('https://time.eurth.org/?old=1#x', emptyTimeline())).toBe(BASE);
    expect(timelineFromLink(BASE)).toBeNull();
    // The site asks for the parameter even then, so that an emptied timeline stays empty.
    expect(timelineLink(BASE, emptyTimeline(), true)).toBe(`${BASE}?t=1.e30`);
    expect(timelineFromLink(`${BASE}?t=1.e30`)).toEqual({ timeline: emptyTimeline(), issues: [] });
    expect(timelineFromLink('not a link')).toBeNull();
    expect(timelineFromLink('https://')).toBeNull();
  });

  it('opens an empty timeline in the calendar that cal.eurth.org hands over', () => {
    const read = timelineFromLink(`${BASE}?cal=${encodeCalendar(KHARAN)}`)!;
    expect(read.issues).toEqual([]);
    expect(read.timeline).toEqual({ ...emptyTimeline(), calendar: KHARAN });
    expect(engineFor(read.timeline.calendar).name).toBe('Kharan Long Year');
    const broken = timelineFromLink(`${BASE}?cal=1.e30`)!;
    expect(broken.timeline.calendar).toBeNull();
    expect(broken.issues.map((issue) => issue.path)).toEqual(['calendar']);
  });

  it('packs tightly', () => {
    const text = encodeTimeline(coast);
    // A third smaller than the timeline written out in full.
    expect(text.length).toBeLessThan(encodeJson(coast).length * 0.7);
    const lone = normalizeTimeline({ tracks: [{ name: 'T', events: [{ title: 'E', date: '5' }] }] }).timeline;
    expect(JSON.parse(atob(encodeTimeline(lone).slice(2)))).toEqual({ k: [['T', 0, [], [['E', '5']]]] });
  });

  it('says when a timeline is too long for a link', () => {
    const long = normalizeTimeline({
      tracks: [{ name: 'Long', events: Array.from({ length: 300 }, (_, i) => ({ title: `Event number ${i}`, date: String(1000 + i), text: 'Something happened, at length.' })) }],
    }).timeline;
    const link = timelineLink(BASE, long);
    expect(link.length).toBeGreaterThan(MAX_LINK_LENGTH);
    expect(linkFits(link)).toBe(false);
    // It still reads back, for whoever pasted it whole.
    expect(timelineFromLink(link)!.timeline).toEqual(long);
  });

  it('gives a tidy timeline or nothing for a mangled link, never an error', () => {
    const good = encodeTimeline(coast);
    for (const junk of [null, 7, '', 'x', '1.', '2.e30', '1.!!!', `1.${'A'.repeat(200_000)}`, encodeJson([1, 2]), encodeJson('text'), encodeJson(null), good.slice(0, 200)]) {
      expect(decodeTimeline(junk), String(junk).slice(0, 20)).toBeNull();
    }
    expect(decodeTimeline(encodeJson({}))!.timeline).toEqual(emptyTimeline());
    const odd = decodeTimeline(encodeJson({ n: 5, e: 'eras', k: [7, ['Track', 9, [['Span', 'never'], ['Kept', '5', '', 99, 3]], [['Event', '6', 'text', [['Site', 'http://insecure']]], 'x']], [null]] }))!;
    expect(odd.timeline.tracks.map((track) => [track.name, track.kind, track.spans.length, track.events.length])).toEqual([['Track', 'nation', 1, 1], ['Track 2', 'nation', 0, 0]]);
    expect(odd.timeline.tracks[0]!.spans[0]).toMatchObject({ label: 'Kept', to: null, tone: 0, text: '' });
    expect(odd.timeline.tracks[0]!.events[0]!.links).toEqual([]);
    expect(odd.issues.length).toBeGreaterThan(0);
    // Dates are read in the calendar that comes with them.
    const text = encodeTimeline(normalizeTimeline({ calendar: SELUNNAN, tracks: [{ events: [{ title: 'E', date: '1022-13-28' }] }] }).timeline);
    expect(encodeDate(decodeTimeline(text, SELUNNAN)!.timeline.tracks[0]!.events[0]!.date)).toBe('1022-13-28');
    expect(encodeDate(decodeTimeline(text)!.timeline.tracks[0]!.events[0]!.date)).toBe('1022');
  });
});

describe('the profile’s timeline section', () => {
  const updated = new Date('2026-11-14T22:30:15.123Z');

  it('holds a digest any tool can quote, and the whole timeline', () => {
    const section = toProfileSection(coast, { link: timelineLink(BASE, coast), updated });
    expect(Object.keys(section)).toEqual(['link', 'summary', 'updated', 'title', 'events', 'definition', 'startYear', 'endYear']);
    expect(section.title).toBe('History of the Oriental Coast');
    expect(section.updated).toBe('2026-11-14T22:30:15Z');
    expect(section.summary).toBe('A timeline from 1600 CE to 1961 CE, dated in the Gregorian calendar, with 4 tracks, 5 spans, 13 events and 3 eras.');
    expect(section.startYear).toBe(1600);
    expect(section.endYear).toBe(1961);
    expect(section.events.length).toBe(13);
    expect(section.events[0]).toEqual({ year: 1622, title: 'Port Delmar is founded' });
    expect(section.events.at(-1)).toEqual({ year: 1961, title: 'First orbital flight' });
    for (let i = 1; i < section.events.length; i++) expect(section.events[i]!.year).toBeGreaterThanOrEqual(section.events[i - 1]!.year);
    expect(section.definition).toEqual(coast);
    expect(section.definition).not.toBe(coast);
  });

  it.each(EXAMPLES.map((example) => [example.id, example] as const))('%s: keeps to what the profile’s schema allows', (_id, example) => {
    const section = toProfileSection(example.timeline, { link: timelineLink(BASE, example.timeline), updated });
    expect(section.link).toMatch(/^https:\/\/[!-~]+$/);
    expect(section.link!.length).toBeLessThanOrEqual(4000);
    expect(section.summary.length).toBeLessThanOrEqual(600);
    expect(section.title.length).toBeLessThanOrEqual(80);
    expect(section.updated).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    expect(section.events.length).toBeLessThanOrEqual(200);
    for (const event of section.events) {
      expect(Number.isInteger(event.year)).toBe(true);
      expect(Math.abs(event.year)).toBeLessThanOrEqual(1_000_000);
      expect(event.title.length).toBeGreaterThan(0);
      expect(event.title.length).toBeLessThanOrEqual(200);
    }
    for (const year of [section.startYear, section.endYear]) expect(year === undefined || (Number.isInteger(year) && Math.abs(year) <= 1_000_000)).toBe(true);
    // A profile file is at most 2 MB and 32 levels deep.
    const json = JSON.stringify({ meta: { schema: 1, nation: 'Example', updated: section.updated }, timeline: section });
    expect(json.length).toBeLessThan(200_000);
    const depth = (value: unknown): number => (typeof value === 'object' && value !== null ? 1 + Math.max(0, ...Object.values(value).map(depth)) : 0);
    expect(depth(JSON.parse(json))).toBeLessThan(16);
    expect(json).not.toContain('__proto__');
    // And it opens again as the same timeline.
    expect(fromProfileSection(JSON.parse(json).timeline)).toEqual({ timeline: example.timeline, issues: [] });
  });

  it('leaves out a link that is too long, and years the schema cannot hold', () => {
    expect(toProfileSection(coast, { updated }).link).toBeUndefined();
    expect(toProfileSection(coast, { link: 'http://time.eurth.org/', updated }).link).toBeUndefined();
    expect(toProfileSection(coast, { link: `${BASE}?t=${'a'.repeat(4000)}`, updated }).link).toBeUndefined();
    const deep = normalizeTimeline({ tracks: [{ events: [{ title: 'First light', date: '-13000000000' }, { title: 'Now', date: '2026' }] }] }).timeline;
    const section = toProfileSection(deep, { updated });
    expect(section.startYear).toBeUndefined();
    expect(section.endYear).toBe(2026);
    expect(section.events).toEqual([{ year: 2026, title: 'Now' }]);
    expect(countItems(section.definition).events).toBe(2);
    const empty = toProfileSection(emptyTimeline(), { updated });
    expect(empty).toMatchObject({ title: '', events: [], summary: 'An empty timeline.' });
    expect('startYear' in empty).toBe(false);
  });

  it('quotes at most 200 events, spread across the whole history', () => {
    const many = normalizeTimeline({ tracks: [{ events: Array.from({ length: LIMITS.events }, (_, i) => ({ title: `E${i}`, date: String(i + 1) })) }] }).timeline;
    const section = toProfileSection(many, { updated });
    expect(section.events.length).toBe(200);
    expect(section.events[0]).toEqual({ year: 1, title: 'E0' });
    expect(section.events.at(-1)).toEqual({ year: LIMITS.events, title: `E${LIMITS.events - 1}` });
    expect(new Set(section.events.map((event) => event.year)).size).toBe(200);
  });

  it('opens a section that only has the plain fields', () => {
    // The "timeline" section of @eurth/profile's Calderwyn example.
    const calderwyn = {
      link: 'https://time.eurth.org/#example-calderwyn',
      updated: '2026-11-10T20:40:00.000Z',
      title: 'History of Calderwyn',
      startYear: 1180,
      endYear: 2026,
      events: [
        { year: 1184, title: 'Haldermouth is founded at the mouth of the Calder' },
        { year: 1412, title: 'The crowns of Calder and Wyn are joined' },
        { year: 1953, title: 'Every adult gets the vote' },
      ],
    };
    const read = fromProfileSection(calderwyn)!;
    expect(read.issues).toEqual([]);
    expect(read.timeline.title).toBe('History of Calderwyn');
    expect(read.timeline.tracks.map((track) => [track.name, track.kind])).toEqual([['History of Calderwyn', 'nation']]);
    expect(read.timeline.tracks[0]!.events.map((event) => [encodeDate(event.date), event.title])).toEqual([
      ['1184', 'Haldermouth is founded at the mouth of the Calder'],
      ['1412', 'The crowns of Calder and Wyn are joined'],
      ['1953', 'Every adult gets the vote'],
    ]);
    expect(fromProfileSection(calderwyn, SELUNNAN)!.timeline.calendar).toEqual(SELUNNAN);
    for (const nothing of [null, 7, 'x', [], {}, { title: 'Only a title' }, { events: [] }, { events: 'many' }]) expect(fromProfileSection(nothing)).toBeNull();
    expect(fromProfileSection({ events: [{ year: 'x', title: 'Bad' }, 5, { year: 3, title: 'Good' }] })!.timeline.tracks[0]!.events.map((event) => event.title)).toEqual(['Good']);
    expect(fromProfileSection({ definition: { title: 'Whole', tracks: 'junk' } })!.timeline.title).toBe('Whole');
  });
});

describe('what Time reads from the rest of a profile', () => {
  it('takes the calendar from Calendar’s section', () => {
    expect(calendarFromSection({ name: 'Selunnan Reckoning', definition: SELUNNAN })).toEqual(SELUNNAN);
    // Without the full definition, the plain fields make a plain calendar.
    const simple = calendarFromSection({
      name: 'Lantern Reckoning',
      daysPerYear: 365,
      months: [{ name: 'Frostwane', days: 31 }, { name: 'Thawing', days: 28 }],
      weekdays: ['Sunday', 'Moonday'],
      era: 'LR',
    })!;
    const engine = engineFor(simple);
    expect([engine.name, engine.era, engine.months.length, engine.meanYear]).toEqual(['Lantern Reckoning', 'LR', 2, 59]);
    for (const nothing of [null, 'x', {}, { months: [] }, { months: [{ days: 30 }] }, { definition: { months: [] } }]) expect(calendarFromSection(nothing)).toBeNull();
    // The profile's schema lets a month go without its days; the engine gives it thirty.
    expect(calendarFromSection({ months: [{ name: 'No days' }] })!.months).toEqual([{ name: 'No days', days: 30 }]);
  });

  it('turns reigns into spans, when Dynasty gives them dates', () => {
    const track = reignsFromDynasty(
      {
        house: 'House of Maravel',
        monarch: 'Queen Ysolde III',
        reigns: [
          { name: 'Queen Ysolde III', from: 1998 },
          { name: 'King Aldous II', from: '1961-3-4', to: '12 June 1998', note: 'Abdicated in favour of his daughter.' },
          { monarch: 'Queen Ysolde II', start: 'c. 1920', end: 1961 },
          { name: 'Backwards', from: 1900, to: 1890 },
          { name: 'No dates' },
          { from: 1800, to: 1810 },
          'junk',
        ],
      },
      gregorian,
    )!;
    expect(track.name).toBe('House of Maravel');
    expect(track.kind).toBe('dynasty');
    expect(track.spans.map((span) => [span.label, encodeDate(span.from), span.to === null ? null : encodeDate(span.to), span.tone])).toEqual([
      ['Backwards', '1890', '1900', 0],
      ['Queen Ysolde II', '~1920', '1961', 1],
      ['King Aldous II', '1961-3-4', '1998-6-12', 0],
      ['Queen Ysolde III', '1998', null, 1],
    ]);
    expect(track.spans[2]!.text).toBe('Abdicated in favour of his daughter.');
    expect(normalizeTimeline({ tracks: [track] }).issues).toEqual([]);
    // The section as the profile's schema has it today names people and gives no dates.
    expect(reignsFromDynasty({ house: 'House of Maravel', monarch: 'Queen Ysolde III', heir: 'Prince Edric', succession: ['Prince Edric'] }, gregorian)).toBeNull();
    for (const nothing of [null, 'x', {}, { reigns: [] }, { reigns: 'many' }, { reigns: [{ name: 'x', from: 'whenever' }] }]) expect(reignsFromDynasty(nothing, gregorian)).toBeNull();
    expect(reignsFromDynasty({ reigns: [{ name: 'Maelis I', from: '17 Harvestmoon 313 FS', to: '351-10-3' }] }, selunnan)!.spans[0]).toMatchObject({
      from: { year: 313, month: 9, day: 17 },
      to: { year: 351, month: 10, day: 3 },
    });
  });

  it('reads a whole profile', () => {
    const section = toProfileSection(selunna, { updated: new Date('2026-11-14T22:00:00Z') });
    const profile = {
      meta: { schema: 1, nation: 'Selunna', updated: '2026-11-14T22:00:00Z' },
      calendar: { name: 'Kharan Long Year', definition: KHARAN },
      dynasty: { house: 'House Ardent', reigns: [{ name: 'Maelis I', from: 313, to: 351 }] },
      timeline: section,
      someNewTool: { anything: true },
    };
    const before = JSON.stringify(profile);
    const read = readProfile(profile);
    expect(JSON.stringify(profile)).toBe(before);
    expect(read.found).toBe(true);
    expect(read.issues).toEqual([]);
    expect(read.timeline).toEqual(selunna);
    // The timeline keeps the calendar it was dated in; the profile's own is offered beside it.
    expect(engineFor(read.timeline.calendar).name).toBe('Selunnan Reckoning');
    expect(engineFor(read.profileCalendar).name).toBe('Kharan Long Year');
    expect(read.reigns!.spans.map((span) => span.label)).toEqual(['Maelis I']);

    const fresh = readProfile({ meta: { schema: 1, nation: 'Khara', updated: '2026-11-14T22:00:00Z' }, calendar: { definition: KHARAN } });
    expect(fresh.found).toBe(false);
    expect(fresh.timeline).toEqual({ ...emptyTimeline(), calendar: KHARAN });
    expect(fresh.reigns).toBeNull();
    for (const nothing of [null, 7, 'x', [], {}]) expect(readProfile(nothing)).toEqual({ timeline: emptyTimeline(), issues: [], found: false, profileCalendar: null, reigns: null });
  });
});
