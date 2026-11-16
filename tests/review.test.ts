import { describe, expect, it } from 'vitest';
import { KHARAN } from '../src/content/calendars';
import { EXAMPLES } from '../src/content/examples';
import { engineFor } from '../src/tool/engine';
import { emptyTimeline, getItem } from '../src/tool/model';
import { normalizeTimeline } from '../src/tool/normalize';
import { reviewTimeline } from '../src/tool/review';
import { gregorian } from './helpers/engines';

const review = (raw: unknown) => {
  const { timeline } = normalizeTimeline(raw);
  return reviewTimeline(timeline, engineFor(timeline.calendar));
};
const ids = (raw: unknown) => review(raw).map((finding) => finding.id);

describe('the reality check', () => {
  it('has nothing to say about an empty timeline', () => {
    expect(reviewTimeline(emptyTimeline(), gregorian)).toEqual([]);
    expect(review({ tracks: [{ name: 'Empty' }] })).toEqual([]);
  });

  it('spots a reign longer than any on record, on a dynasty track only', () => {
    const reign = { label: 'Queen Maelis', from: '1600', to: '1690' };
    const found = review({ tracks: [{ name: 'House Ardent', kind: 'dynasty', spans: [reign, { label: 'King Corvan', from: '1690', to: '1762' }] }] });
    expect(found.map((finding) => finding.id)).toEqual(['long-reign']);
    expect(found[0]!.message).toBe('Queen Maelis lasts 90 years. The longest reign on record is 72 years, and that king was crowned at four.');
    expect(found[0]!.refs).toEqual([{ kind: 'span', track: 0, index: 0 }]);
    // A state may last ninety years; only a reign may not.
    expect(ids({ tracks: [{ name: 'Teland', kind: 'nation', spans: [reign] }] })).toEqual([]);
    // A reign still going on has no length yet.
    expect(ids({ tracks: [{ name: 'House Ardent', kind: 'dynasty', spans: [{ label: 'Queen Maelis', from: '1600' }] }] })).toEqual([]);
  });

  it('spots reigns all of a length, and reigns too long on average', () => {
    const even = { tracks: [{ name: 'House Ardent', kind: 'dynasty', spans: [0, 1, 2, 3, 4].map((i) => ({ label: `King ${i}`, from: String(1000 + i * 50), to: String(1048 + i * 50) })) }] };
    const found = review(even);
    expect(found.map((finding) => finding.id)).toEqual(['even-reigns', 'long-reigns']);
    expect(found[0]!.message).toContain('The reigns on House Ardent all last about 48 years.');
    expect(found[1]!.message).toContain('average 48 years');
    expect(found[0]!.refs.length).toBe(5);
    // Uneven and of ordinary length: nothing to say.
    const lengths = [38, 1, 37, 12, 22, 4];
    let year = 1000;
    const uneven = lengths.map((n, i) => ({ label: `Ruler ${i}`, from: String(year), to: String((year += n)) }));
    expect(ids({ tracks: [{ name: 'House Ardent', kind: 'dynasty', spans: uneven }] })).toEqual([]);
    // Three reigns are too few to judge.
    expect(ids({ tracks: [{ name: 'House Ardent', kind: 'dynasty', spans: even.tracks[0]!.spans.slice(0, 3) }] })).toEqual([]);
  });

  it('spots a war that runs for generations, and a cathedral built in no time', () => {
    const found = review({
      tracks: [
        {
          name: 'Teland',
          spans: [
            { label: 'The Salt War', from: '1500', to: '1561' },
            { label: 'The Short War', from: '1600', to: '1604' },
            { label: 'Building of the Cathedral of Lanterns', from: '1610', to: '1613' },
            { label: 'Building of the Old Temple', from: '1300', to: '1402' },
            { label: 'Warden of the North', from: '1400', to: '1470' },
          ],
        },
      ],
    });
    expect(found.map((finding) => finding.id)).toEqual(['long-war', 'quick-building']);
    expect(found[0]!.message).toContain('The Salt War lasts 61 years.');
    expect(found[1]!.message).toContain('Building of the Cathedral of Lanterns takes 3 years.');
  });

  it('spots spans that are all too tidy', () => {
    const tidy = [10, 25, 40, 5, 60].map((n, i) => ({ label: `Age ${i}`, from: String(1000 + i * 80), to: String(1000 + i * 80 + n) }));
    expect(ids({ tracks: [{ name: 'Ages', spans: tidy }] })).toEqual(['tidy-spans']);
    expect(ids({ tracks: [{ name: 'Ages', spans: [...tidy.slice(0, 4), { label: 'Odd', from: '1320', to: '1357' }] }] })).toEqual([]);
    // Dates given more finely than a year are nobody's round numbers.
    expect(ids({ tracks: [{ name: 'Ages', spans: tidy.map((span) => ({ ...span, to: `${span.to}-3-1` })) }] })).toEqual([]);
  });

  it('spots a long past with no doubt in it, and old dates known to the day', () => {
    const events = [1, 300, 600, 900, 1200, 1500].map((year) => ({ title: `Event of ${year}`, date: String(year) }));
    expect(ids({ tracks: [{ name: 'Teland', spans: [{ label: 'Kingdom', from: '1', to: '1503' }], events }] })).toEqual(['no-doubt']);
    expect(review({ tracks: [{ name: 'Teland', spans: [{ label: 'Kingdom', from: '1', to: '1503' }], events }] })[0]!.message).toContain('across 1503 years');
    // One "c." is enough.
    expect(ids({ tracks: [{ name: 'Teland', spans: [{ label: 'Kingdom', from: '~1', to: '1503' }], events }] })).toEqual([]);
    // A short history needs no doubt.
    expect(ids({ tracks: [{ name: 'Teland', spans: [{ label: 'Kingdom', from: '1800', to: '1903' }], events: events.map((event, i) => ({ ...event, date: String(1800 + i * 20) })) }] })).toEqual([]);
    const sharp = review({ tracks: [{ name: 'Teland', spans: [{ label: 'Kingdom', from: '~1', to: '1503' }], events: [{ title: 'The Founding', date: '1-1-1' }, { title: 'The Flood', date: '200-6-2' }, { title: 'Recent', date: '1500-6-2' }] }] });
    expect(sharp.map((finding) => finding.id)).toEqual(['sharp-past']);
    expect(sharp[0]!.message).toBe('The Founding is dated to the day, 1503 years before the latest thing here, and 1 more like it. Records that old seldom keep the day. If this one did, say why.');
    expect(sharp[0]!.refs).toEqual([{ kind: 'event', track: 0, index: 0 }, { kind: 'event', track: 0, index: 1 }]);
  });

  it('spots a history made only of events', () => {
    const events = Array.from({ length: 8 }, (_, i) => ({ title: `Battle ${i}`, date: `~${1800 + i}` }));
    expect(ids({ tracks: [{ name: 'Wars', events }] })).toEqual(['all-events']);
    expect(ids({ tracks: [{ name: 'Wars', events }], eras: [{ label: 'An age', from: '1700' }] })).toEqual([]);
    expect(ids({ tracks: [{ name: 'Wars', events: events.slice(0, 7) }] })).toEqual([]);
  });

  it('measures in Earth’s years and speaks in the calendar’s own', () => {
    // A Kharan year is 412 days: 70 of them are 79 of Earth's, longer than any reign on record.
    const found = review({ calendar: KHARAN, tracks: [{ name: 'House of Dunn', kind: 'dynasty', spans: [{ label: 'Dunn the Old', from: '100', to: '170' }, { label: 'Dunn the Young', from: '170', to: '230' }] }] });
    expect(found.map((finding) => finding.id)).toEqual(['long-reign']);
    expect(found[0]!.message).toContain("Dunn the Old lasts 70 years (79 of Earth's).");
  });

  it('finds little wrong with the examples, and says what it does find', () => {
    const found = Object.fromEntries(EXAMPLES.map((example) => [example.id, reviewTimeline(example.timeline, engineFor(example.timeline.calendar)).map((finding) => finding.id)]));
    expect(found).toEqual({ 'oriental-coast': ['long-war'], selunna: [], khara: [] });
    for (const example of EXAMPLES) {
      for (const finding of reviewTimeline(example.timeline, engineFor(example.timeline.calendar))) {
        expect(finding.message).toMatch(/^[A-Z].*[.]$/);
        expect(finding.message).not.toMatch(/undefined|NaN/);
        for (const ref of finding.refs) expect(getItem(example.timeline, ref)).not.toBeNull();
      }
    }
  });

  it('never says more than a dozen things', () => {
    const spans = Array.from({ length: 40 }, (_, i) => ({ label: `The ${i}th War`, from: String(1000 + i), to: String(1100 + i) }));
    expect(review({ tracks: [{ name: 'Wars', spans }] }).length).toBe(12);
  });
});
