import { describe, expect, it } from 'vitest';
import { GREGORIAN, KHARAN, MERIDIAN, SELUNNAN } from '../src/content/calendars';
import { exampleById } from '../src/content/examples';
import { xOf } from '../src/tool/axis';
import { yearStart } from '../src/tool/dates';
import { canConvert, convertDate, convertDay, convertTimeline, sameCalendar, viewIn } from '../src/tool/convert';
import { ALSO_PARAM, timelineFromLink, timelineLink } from '../src/tool/link';
import { setAlso, setCalendar } from '../src/tool/ops';
import { dateOfDay, dateRange, encodeDate, formatDate } from '../src/tool/fuzzy';
import { countItems } from '../src/tool/model';
import { normalizeTimeline } from '../src/tool/normalize';
import { mergeTimeline } from '../src/tool/ops';
import { between, gregorian, kharan, meridian, random, selunnan, tidewatch } from './helpers/engines';

describe('which calendars can be compared', () => {
  it('knows where each calendar stands in Earth’s days', () => {
    expect(gregorian.earth).toBe(0);
    // Day 1 of year 1 of the Selunnan Reckoning is 15 February 1008.
    expect(dateOfDay(gregorian, selunnan.earth!)).toEqual({ year: 1008, month: 2, day: 15 });
    // The Meridian Republic counts from 22 September 1792.
    expect(dateOfDay(gregorian, meridian.earth!)).toEqual({ year: 1792, month: 9, day: 22 });
    expect(kharan.earth).toBeNull();
    expect(tidewatch.earth).toBeNull();
  });

  it('compares two calendars only when both are tied to Earth', () => {
    expect(canConvert(selunnan, gregorian)).toBe(true);
    expect(canConvert(selunnan, meridian)).toBe(true);
    expect(canConvert(kharan, gregorian)).toBe(false);
    expect(canConvert(gregorian, tidewatch)).toBe(false);
    expect(canConvert(kharan, tidewatch)).toBe(false);
    // A calendar is always comparable with itself.
    expect(canConvert(kharan, kharan)).toBe(true);
    expect(sameCalendar(null, null)).toBe(true);
    expect(sameCalendar(SELUNNAN, JSON.parse(JSON.stringify(SELUNNAN)))).toBe(true);
    expect(sameCalendar(SELUNNAN, null)).toBe(false);
    expect(sameCalendar(SELUNNAN, MERIDIAN)).toBe(false);
  });
});

describe('a date in another calendar', () => {
  it('turns a day into the same day', () => {
    // 17 Harvestmoon 1022 FS is 12 November 2026, as @eurth/calendar has it.
    expect(convertDate(selunnan, gregorian, { year: 1022, month: 9, day: 17 })).toEqual({ year: 2026, month: 11, day: 12 });
    expect(convertDate(gregorian, selunnan, { year: 2026, month: 11, day: 12 })).toEqual({ year: 1022, month: 9, day: 17 });
    expect(formatDate(meridian, convertDate(gregorian, meridian, { year: 1792, month: 9, day: 22 }))).toBe('1 Vintage 1 YR');
    expect(formatDate(selunnan, convertDate(gregorian, selunnan, { year: 1008, month: 2, day: 14 }))).toBe('28 Darkmoon 1 Before the Founding');
    const same = { year: 5, month: 3, day: 2 };
    expect(convertDate(kharan, kharan, same)).toBe(same);
  });

  it('carries a day there and back exactly, through any pair of linked calendars', () => {
    const next = random(51);
    const engines = [gregorian, selunnan, meridian];
    for (let i = 0; i < 3000; i++) {
      const from = engines[between(next, 0, 2)]!;
      const to = engines[between(next, 0, 2)]!;
      const days = between(next, -2_000_000, 2_000_000);
      const date = dateOfDay(from, days);
      const there = convertDate(from, to, date);
      expect(dateRange(to, there).first).toBe(convertDay(from, to, days));
      expect(convertDate(to, from, there)).toEqual(date);
    }
  });

  it('carries looser dates loosely', () => {
    // Harvestmoon 1022 runs from late October to late November 2026: its middle is in November.
    expect(convertDate(selunnan, gregorian, { year: 1022, month: 9 })).toEqual({ year: 2026, month: 11 });
    // The Selunnan year 1022 runs from February 2026 to February 2027.
    expect(convertDate(selunnan, gregorian, { year: 1022 })).toEqual({ year: 2026 });
    expect(convertDate(selunnan, gregorian, { year: 1022, circa: true })).toEqual({ year: 2026, circa: true });
    // A decade is a round number in one calendar only: in the other it is "about" its middle.
    expect(convertDate(gregorian, selunnan, { year: 1650, span: 'decade' })).toEqual({ year: 649, circa: true });
    expect(convertDate(gregorian, selunnan, { year: 1601, span: 'century' })).toEqual({ year: 645, circa: true });
    // Midyear Day is a day like any other.
    expect(convertDate(selunnan, gregorian, { year: 1020, intercalary: 1, day: 1 })).toEqual({ year: 2024, month: 9, day: 30 });
    // Beyond what the engines count day by day there are only years, and a Selunnan year is a day
    // shorter than Earth's: over thirteen thousand million years that adds up to forty million more of them.
    expect(convertDate(gregorian, selunnan, { year: -13_800_000_000 })).toEqual({ year: -13_839_502_657 });
  });
});

describe('a timeline in another calendar', () => {
  const selunna = exampleById('selunna')!.timeline;
  const coast = exampleById('oriental-coast')!.timeline;
  const khara = exampleById('khara')!.timeline;

  it('comes back as it is when the calendar is the same', () => {
    expect(convertTimeline(coast, null)).toEqual({ timeline: coast, converted: false });
    expect(convertTimeline(selunna, JSON.parse(JSON.stringify(SELUNNAN)))!.timeline).toBe(selunna);
    expect(convertTimeline(khara, KHARAN)!.converted).toBe(false);
  });

  it('turns every date, and loses nothing', () => {
    const turned = convertTimeline(selunna, null)!;
    expect(turned.converted).toBe(true);
    expect(turned.timeline.calendar).toBeNull();
    expect(countItems(turned.timeline)).toEqual(countItems(selunna));
    expect(normalizeTimeline(turned.timeline).issues).toEqual([]);
    const founding = turned.timeline.tracks[0]!.events[0]!;
    expect([founding.title, formatDate(gregorian, founding.date)]).toEqual(['The Founding', '15 February 1008 CE']);
    expect(formatDate(gregorian, turned.timeline.tracks[0]!.events[1]!.date)).toMatch(/^\d+ [A-Z][a-z]+ 1012 CE$/);
    // The standing stones, some time in the 4th century Before the Founding: about 659 CE.
    expect(encodeDate(turned.timeline.tracks[2]!.events[0]!.date)).toBe('~659');
    // A day survives the round trip; a year may slip, which is why it is only ever "about" a year.
    const back = convertTimeline(turned.timeline, SELUNNAN)!.timeline;
    expect(back.tracks[0]!.events[0]!.date).toEqual(selunna.tracks[0]!.events[0]!.date);
    expect(back.tracks[1]!.spans[1]).toEqual(selunna.tracks[1]!.spans[1]);
    // The Gregorian calendar by name is the same calendar as none at all: nothing to turn.
    expect(convertTimeline(coast, GREGORIAN)).toEqual({ timeline: coast, converted: false });
    expect(sameCalendar(null, GREGORIAN)).toBe(true);
  });

  it('refuses when one of the calendars stands alone', () => {
    expect(convertTimeline(khara, null)).toBeNull();
    expect(convertTimeline(coast, KHARAN)).toBeNull();
    expect(convertTimeline(khara, SELUNNAN)).toBeNull();
  });

  it('lets a friend’s nation join yours, in your calendar', () => {
    const theirs = convertTimeline(selunna, coast.calendar)!.timeline;
    const { timeline, added } = mergeTimeline(coast, theirs);
    expect(added).toEqual({ tracks: 3, spans: 7, events: 9, eras: 4 });
    expect(timeline.calendar).toBeNull();
    expect(timeline.tracks.map((track) => track.name)).toEqual(['Teland', 'Ostaril', 'Coastal League', 'Shared world', 'Selunna', 'House Ardent', 'The wider world']);
    expect(normalizeTimeline(timeline).issues).toEqual([]);
  });
});

describe('a second calendar to read the axis in', () => {
  const selunna = exampleById('selunna')!.timeline;
  const coast = exampleById('oriental-coast')!.timeline;
  const khara = exampleById('khara')!.timeline;

  it('is kept when it differs from the timeline’s own and both are tied to Earth', () => {
    expect(setAlso(selunna, GREGORIAN).also).toEqual(GREGORIAN);
    expect(setAlso(coast, SELUNNAN).also).toEqual(SELUNNAN);
    expect(setAlso(selunna, MERIDIAN).also).toEqual(MERIDIAN);
    expect(setAlso(setAlso(selunna, GREGORIAN), null).also).toBeNull();
    // Nothing else about the timeline changes.
    expect({ ...setAlso(selunna, GREGORIAN), also: null }).toEqual(selunna);
  });

  it('is left out when there is no reading one calendar in the other', () => {
    // The same calendar twice, a calendar that stands alone, and no calendar at all.
    expect(setAlso(coast, GREGORIAN).also).toBeNull();
    expect(setAlso(selunna, SELUNNAN).also).toBeNull();
    expect(setAlso(coast, KHARAN).also).toBeNull();
    expect(setAlso(khara, GREGORIAN).also).toBeNull();
    for (const junk of ['gregorian', 7, {}, { months: [] }]) {
      const { timeline, issues } = normalizeTimeline({ ...selunna, also: junk });
      expect(timeline.also).toBeNull();
      expect(issues.map((issue) => issue.path)).toEqual(['also']);
    }
    // Putting the timeline in the calendar that was its second leaves it with none.
    expect(setCalendar(setAlso(selunna, GREGORIAN), null).timeline.also).toBeNull();
    expect(setCalendar(setAlso(selunna, GREGORIAN), KHARAN).timeline.also).toBeNull();
  });

  it('travels in the link', () => {
    const both = setAlso(selunna, GREGORIAN);
    const link = timelineLink('https://time.eurth.org/', both, true);
    expect(new URL(link).searchParams.has(ALSO_PARAM)).toBe(true);
    expect(timelineFromLink(link)).toEqual({ timeline: both, issues: [] });
    expect(new URL(timelineLink('https://time.eurth.org/', selunna, true)).searchParams.has(ALSO_PARAM)).toBe(false);
    // A second calendar that can't be one is dropped, with a word about it.
    const odd = timelineFromLink(link.replace(/also=[^&]+/, `also=${new URL(timelineLink('https://time.eurth.org/', khara, true)).searchParams.get('cal')}`))!;
    expect(odd.timeline.also).toBeNull();
    expect(odd.issues.map((issue) => issue.path)).toEqual(['also']);
    expect(odd.timeline.tracks).toEqual(selunna.tracks);
  });

  it('shows the same stretch of time in the other calendar’s days', () => {
    const view = { start: yearStart(selunnan, 1022), end: yearStart(selunnan, 1023), width: 900 };
    const other = viewIn(selunnan, gregorian, view);
    expect(other.width).toBe(900);
    expect(other.end - other.start).toBe(view.end - view.start);
    // 17 Harvestmoon 1022 FS and 12 November 2026 are the same pixel.
    const here = dateRange(selunnan, { year: 1022, month: 9, day: 17 }).first;
    const there = dateRange(gregorian, { year: 2026, month: 11, day: 12 }).first;
    expect(xOf(other, there)).toBeCloseTo(xOf(view, here), 9);
    expect(viewIn(kharan, kharan, view)).toEqual(view);
  });
});
