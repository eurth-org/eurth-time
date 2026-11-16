import { createProfile, parseProfile, serialiseProfile, setSection, validateProfile } from '@eurth/profile';
import { describe, expect, it } from 'vitest';
import { SELUNNAN } from '../src/content/calendars';
import { exampleById } from '../src/content/examples';
import { fitView } from '../src/tool/axis';
import { convertTimeline } from '../src/tool/convert';
import { timelineCsv, timelineFromCsv } from '../src/tool/csv';
import { describeItem, describeTimeline, descriptionText, itemLine } from '../src/tool/describe';
import { embedLink } from '../src/tool/embed';
import { extentOf } from '../src/tool/layout';
import { MAX_LINK_LENGTH, decodeTimeline, encodeTimeline, linkProblem, timelineFromLink, timelineLink } from '../src/tool/link';
import { hasPictures, picturesOf, type Ref, type Timeline } from '../src/tool/model';
import { normalizeTimeline } from '../src/tool/normalize';
import { addEvent, mergeTimeline, updateItem } from '../src/tool/ops';
import { PICTURE_LIMITS, PICTURE_TYPES, SHRINK_STEPS, cleanPicture, fitWithin, pictureType, pictureWords, type Picture } from '../src/tool/picture';
import { printSheets } from '../src/tool/print';
import { readProfile, toProfileSection } from '../src/tool/profile';
import { timelineSvg } from '../src/tool/svg';
import { timelineWikitext } from '../src/tool/wikitext';
import { gregorian } from './helpers/engines';
import { TEST_THEME, readCsv, readXml } from './helpers/theme';

// The smallest real pictures there are: one pixel each.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const WEBP = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z';

/** A picture of a given length, as stored: a real PNG start, then filler. */
function sized(length: number): string {
  const head = 'data:image/png;base64,';
  const start = PNG.slice(head.length, head.length + 24);
  const body = Math.floor((length - head.length) / 4) * 4;
  return `${head}${start}${'A'.repeat(body - start.length)}`;
}

const map: Picture = { data: WEBP, alt: 'A map of the straits, with the League’s ports marked', decorative: false };
const coast = exampleById('oriental-coast')!.timeline;
const treaty: Ref = { kind: 'event', track: 2, index: 1 };
const war: Ref = { kind: 'span', track: 2, index: 0 };
const withMap = updateItem(coast, treaty, { picture: map });

describe('what counts as a picture', () => {
  it('is a small JPEG, PNG or WebP carried in the file itself', () => {
    expect(pictureType(PNG)).toBe('image/png');
    expect(pictureType(WEBP)).toBe('image/webp');
    expect(pictureType(JPEG)).toBe('image/jpeg');
    expect([...PICTURE_TYPES]).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    expect(pictureType(sized(PICTURE_LIMITS.length))).toBe('image/png');
  });

  it('is nothing else', () => {
    const svg = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')}`;
    const turnedAway: unknown[] = [
      null,
      7,
      '',
      'picture.png',
      'https://example.org/picture.png',
      'data:,',
      svg,
      `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"/>')}`,
      `data:image/gif;base64,${btoa('GIF89a')}AAAA`,
      `data:text/html;base64,${btoa('<script>alert(1)</script>')}`,
      // Called one thing, made of another.
      PNG.replace('image/png', 'image/jpeg'),
      JPEG.replace('image/jpeg', 'image/webp'),
      `data:image/png;base64,${btoa('<script>alert(1)</script>!')}`,
      // Not as the browser writes it.
      PNG.replace(';base64', ';charset=utf-8;base64'),
      PNG.replace('data:', 'DATA:'),
      `${PNG} `,
      `${PNG}\n`,
      PNG.replace('base64,', 'base64, '),
      `${PNG.slice(0, -4)}%3D%3D`,
      `${PNG}A`,
      PNG.replace(';base64', ''),
      // Too big to carry.
      sized(PICTURE_LIMITS.length + 4),
    ];
    for (const bad of turnedAway) expect(pictureType(bad), String(bad).slice(0, 50)).toBeNull();
  });

  it('needs words, or to be marked as decorative', () => {
    expect(cleanPicture({ data: PNG, alt: '  The harbour   at dawn  ' })).toEqual({ picture: { data: PNG, alt: 'The harbour at dawn', decorative: false }, problem: null });
    expect(cleanPicture({ data: PNG, alt: '', decorative: true })).toEqual({ picture: { data: PNG, alt: '', decorative: true }, problem: null });
    // A decorative picture says nothing, whatever was typed.
    expect(cleanPicture({ data: PNG, alt: 'Ignored', decorative: true }).picture).toEqual({ data: PNG, alt: '', decorative: true });
    expect(cleanPicture({ data: PNG })).toEqual({ picture: null, problem: 'no-description' });
    expect(cleanPicture({ data: PNG, alt: '   ', decorative: 'yes' })).toEqual({ picture: null, problem: 'no-description' });
    expect(cleanPicture({ data: 'https://example.org/a.png', alt: 'A' })).toEqual({ picture: null, problem: 'not-a-picture' });
    for (const junk of [null, 7, 'x', [], PNG]) expect(cleanPicture(junk)).toEqual({ picture: null, problem: 'not-a-picture' });
    const long = cleanPicture({ data: PNG, alt: `A${String.fromCharCode(7)}b ${'x'.repeat(500)}`, extra: 'dropped' }).picture!;
    expect(long.alt.length).toBe(PICTURE_LIMITS.alt);
    expect(long.alt.startsWith('Ab x')).toBe(true);
    expect(Object.keys(long)).toEqual(['data', 'alt', 'decorative']);
    expect(pictureWords(map)).toBe(map.alt);
    expect(pictureWords({ data: PNG, alt: '', decorative: true })).toBe('');
    expect(pictureWords(null)).toBe('');
  });

  it('is drawn no larger than a card needs, and never enlarged', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 640, height: 480 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 480, height: 640 });
    expect(fitWithin(320, 200)).toEqual({ width: 320, height: 200 });
    expect(fitWithin(640, 640)).toEqual({ width: 640, height: 640 });
    expect(fitWithin(10_000, 10)).toEqual({ width: 640, height: 1 });
    expect(fitWithin(1000, 500, 240)).toEqual({ width: 240, height: 120 });
    for (const [w, h] of [[0, 10], [10, 0], [-5, 5], [NaN, 5]] as const) expect(fitWithin(w, h)).toEqual({ width: 1, height: 1 });
    // The steps start at the cap and only ever ask for less.
    expect(SHRINK_STEPS[0]!.side).toBe(PICTURE_LIMITS.side);
    for (let i = 1; i < SHRINK_STEPS.length; i++) {
      expect(SHRINK_STEPS[i]!.side).toBeLessThanOrEqual(SHRINK_STEPS[i - 1]!.side);
      expect(SHRINK_STEPS[i]!.quality).toBeLessThanOrEqual(SHRINK_STEPS[i - 1]!.quality);
    }
  });
});

describe('pictures on a timeline', () => {
  it('sit on an event or a span, and nowhere else', () => {
    expect(hasPictures(coast)).toBe(false);
    expect(hasPictures(withMap)).toBe(true);
    expect(withMap.tracks[2]!.events[1]!.picture).toEqual(map);
    const both = updateItem(withMap, war, { picture: { data: JPEG, alt: '', decorative: true } });
    expect(picturesOf(both).map((item) => ('title' in item ? item.title : item.label))).toEqual(['Coastal War era', 'Treaty of Selunna']);
    expect(updateItem(both, treaty, { picture: null }).tracks[2]!.events[1]!.picture).toBeNull();
    const added = addEvent(coast, 0, { title: 'The harbour freezes', date: { year: 1740 }, picture: { data: PNG, alt: 'Ships held in the ice', decorative: false } });
    expect(picturesOf(added.timeline)).toHaveLength(1);
    // An era has no card of its own to put one on.
    expect('picture' in normalizeTimeline({ eras: [{ label: 'Age', from: '1', picture: map }] }).timeline.eras[0]!).toBe(false);
    expect(normalizeTimeline(both)).toEqual({ timeline: both, issues: [] });
  });

  it('are turned away, and said to be, when they are not small pictures with words', () => {
    const { timeline, issues } = normalizeTimeline({
      tracks: [
        {
          name: 'T',
          events: [
            { title: 'Linked', date: '1', picture: { data: 'https://example.org/a.png', alt: 'A' } },
            { title: 'Script', date: '2', picture: { data: `data:image/svg+xml;base64,${btoa('<svg/>')}`, alt: 'A' } },
            { title: 'Wordless', date: '3', picture: { data: PNG } },
            { title: 'Huge', date: '4', picture: { data: sized(PICTURE_LIMITS.length + 400), alt: 'A' } },
            { title: 'Junk', date: '5', picture: 'picture' },
            { title: 'Fine', date: '6', picture: { data: PNG, alt: 'A dot' } },
            { title: 'None', date: '7', picture: null },
          ],
        },
      ],
    });
    expect(timeline.tracks[0]!.events.map((event) => [event.title, event.picture === null])).toEqual([['Linked', true], ['Script', true], ['Wordless', true], ['Huge', true], ['Junk', true], ['Fine', false], ['None', true]]);
    expect(issues.map((issue) => issue.path)).toEqual([0, 1, 2, 3, 4].map((i) => `tracks[0].events[${i}].picture`));
    expect(issues[2]!.message).toBe('A picture had no description and was not marked as decorative, so it was left out.');
    expect(issues[0]!.message).toBe('A picture was left out: it has to be a small JPEG, PNG or WebP carried in the file itself.');
    // The things themselves stay.
    expect(timeline.tracks[0]!.events).toHaveLength(7);
  });

  it('are at most twelve, and no more than a profile file has room for', () => {
    const events = (n: number, data: string) => Array.from({ length: n }, (_, i) => ({ title: `E${i}`, date: String(i + 1), picture: { data, alt: `Picture ${i}` } }));
    const many = normalizeTimeline({ tracks: [{ name: 'T', events: events(PICTURE_LIMITS.count + 3, PNG) }] });
    expect(picturesOf(many.timeline)).toHaveLength(PICTURE_LIMITS.count);
    expect(many.timeline.tracks[0]!.events).toHaveLength(PICTURE_LIMITS.count + 3);
    expect(many.issues).toHaveLength(1);
    expect(many.issues[0]!.message).toContain('at most 12 pictures');
    // Twelve of the largest are more than the room there is: the last two are left out.
    const heavy = normalizeTimeline({ tracks: [{ name: 'T', events: events(PICTURE_LIMITS.count, sized(PICTURE_LIMITS.length)) }] });
    expect(picturesOf(heavy.timeline)).toHaveLength(Math.floor(PICTURE_LIMITS.total / PICTURE_LIMITS.length));
    expect(picturesOf(heavy.timeline).reduce((sum, item) => sum + item.picture!.data.length, 0)).toBeLessThanOrEqual(PICTURE_LIMITS.total);
    expect(heavy.issues).toHaveLength(1);
    expect(PICTURE_LIMITS).toEqual({ side: 640, length: 120_000, count: 12, total: 1_200_000, alt: 300 });
  });

  it('come along when a timeline is merged or put in another calendar', () => {
    const merged = mergeTimeline(coast, normalizeTimeline({ tracks: [{ name: 'Ardenmark', events: [{ title: 'Founded', date: '1699', picture: map }] }] }).timeline).timeline;
    expect(picturesOf(merged)).toHaveLength(1);
    expect(picturesOf(convertTimeline(withMap, SELUNNAN)!.timeline).map((item) => item.picture)).toEqual([map]);
  });
});

describe('a timeline with pictures and its link', () => {
  it('has no link to hand out, and says why', () => {
    const link = timelineLink('https://time.eurth.org/', withMap, true);
    expect(link.length).toBeLessThan(MAX_LINK_LENGTH);
    expect(linkProblem(withMap, link)).toBe('pictures');
    expect(linkProblem(coast, timelineLink('https://time.eurth.org/', coast, true))).toBeNull();
    expect(linkProblem(coast, `https://time.eurth.org/?t=${'a'.repeat(MAX_LINK_LENGTH)}`)).toBe('long');
    // Pictures first: making the timeline shorter would not help.
    expect(linkProblem(withMap, `https://time.eurth.org/?t=${'a'.repeat(MAX_LINK_LENGTH)}`)).toBe('pictures');
    expect(linkProblem(withMap, embedLink('https://time.eurth.org/', withMap))).toBe('pictures');
  });

  it('never carries a picture, and never leaves one behind in silence', () => {
    const text = encodeTimeline(withMap);
    const packed = atob(text.slice(2).replace(/-/g, '+').replace(/_/g, '/'));
    expect(packed).not.toContain('data:');
    expect(packed).not.toContain('UklGR');
    expect(packed).not.toContain('map of the straits');
    // A link made in spite of all this says what it left behind when it is opened.
    const opened = decodeTimeline(text)!;
    expect(hasPictures(opened.timeline)).toBe(false);
    expect(opened.issues).toEqual([{ path: 'pictures', message: 'This link came without its picture: pictures travel in the profile file, not in a link.' }]);
    const two = updateItem(withMap, war, { picture: { data: PNG, alt: 'A fleet', decorative: false } });
    expect(timelineFromLink(timelineLink('https://time.eurth.org/', two, true))!.issues[0]!.message).toContain('without its 2 pictures');
    expect(decodeTimeline(encodeTimeline(coast))!.issues).toEqual([]);
    // Everything but the pictures is there.
    expect(opened.timeline).toEqual(coast);
  });
});

describe('a timeline with pictures in the profile file', () => {
  it('is saved whole and opens again, by the real @eurth/profile', () => {
    const section = toProfileSection(withMap);
    expect(section.link).toBeUndefined();
    expect(section.definition.tracks[2]!.events[1]!.picture).toEqual(map);
    const profile = setSection(createProfile('Teland'), 'timeline', section);
    expect(validateProfile(profile).ok).toBe(true);
    const parsed = parseProfile(serialiseProfile(profile));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(readProfile(parsed.profile)).toMatchObject({ found: true, issues: [], timeline: withMap });
  });

  it('fits in a profile file even with every picture it may carry', () => {
    const size = PICTURE_LIMITS.total / PICTURE_LIMITS.count;
    let full: Timeline = coast;
    const refs: Ref[] = coast.tracks.flatMap((track, t) => track.events.map((_, index): Ref => ({ kind: 'event', track: t, index }))).slice(0, PICTURE_LIMITS.count);
    for (const ref of refs) full = updateItem(full, ref, { picture: { data: sized(size), alt: 'As large as a picture may be', decorative: false } });
    expect(picturesOf(full)).toHaveLength(PICTURE_LIMITS.count);
    const text = serialiseProfile(setSection(createProfile('Teland'), 'timeline', toProfileSection(full)));
    expect(text.length).toBeLessThan(1_900_000);
    const parsed = parseProfile(text);
    expect(parsed.ok ? [] : parsed.errors).toEqual([]);
    if (parsed.ok) expect(picturesOf(readProfile(parsed.profile).timeline)).toHaveLength(PICTURE_LIMITS.count);
  });
});

describe('what each export does with a picture', () => {
  const decorated = updateItem(withMap, war, { picture: { data: JPEG, alt: '', decorative: true } });
  const view = fitView(gregorian, extentOf(decorated, gregorian)!, 1000);

  it('the words say what it shows, and pass over a decorative one', () => {
    const item = describeItem(decorated, gregorian, treaty)!;
    expect(item.picture).toBe(map.alt);
    expect(itemLine(item)).toBe(`1789 CE: Treaty of Selunna. ${coast.tracks[2]!.events[1]!.text} Picture: ${map.alt}.`);
    expect(describeItem(decorated, gregorian, war)!.picture).toBe('');
    const text = descriptionText(describeTimeline(decorated, gregorian));
    expect(text.match(/Picture:/g)).toHaveLength(1);
    expect(text).not.toContain('data:');
    // A thing with a picture and no text still reads as a sentence.
    const bare = updateItem(coast, { kind: 'event', track: 0, index: 3 }, { picture: { data: PNG, alt: 'A ballot box', decorative: false } });
    expect(itemLine(describeItem(bare, gregorian, { kind: 'event', track: 0, index: 3 })!)).toBe('1923 CE: Every adult gets the vote. Picture: A ballot box.');
  });

  it('the picture of the chart, and the printed sheets, leave it out and keep its words', () => {
    const { svg } = timelineSvg(decorated, gregorian, view, { theme: TEST_THEME });
    readXml(svg);
    expect(svg).not.toContain('data:');
    expect(svg).not.toContain('<image');
    expect(svg).toContain(`Picture: ${map.alt.replace('’', '’')}`);
    for (const sheet of printSheets(decorated, gregorian, { first: view.start, last: view.end }, 2, TEST_THEME)) expect(sheet.svg).not.toContain('data:');
  });

  it('the wiki table and the sheet carry its description, not the picture', () => {
    const wiki = timelineWikitext(decorated, gregorian);
    expect(wiki).toContain(`(Picture: ${map.alt})`);
    expect(wiki).not.toContain('data:');
    const rows = readCsv(timelineCsv(decorated, gregorian));
    const column = rows[0]!.indexOf('picture');
    expect(column).toBe(rows[0]!.length - 1);
    expect(rows.find((row) => row[2] === 'Treaty of Selunna')![column]).toBe(map.alt);
    expect(rows.find((row) => row[2] === 'Coastal War era')![column]).toBe('');
    expect(timelineCsv(decorated, gregorian)).not.toContain('data:');
    // Reading a sheet back brings no pictures in.
    expect(hasPictures(timelineFromCsv(timelineCsv(decorated, gregorian))!.timeline)).toBe(false);
  });
});
