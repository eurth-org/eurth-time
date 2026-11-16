import { describe, expect, it } from 'vitest';
import { EXAMPLES, exampleById } from '../src/content/examples';
import { clampView, fitView, zoomView, type View } from '../src/tool/axis';
import { CSV_COLUMNS, MAX_CSV_LENGTH, csvCell, parseCsv, timelineCsv, timelineFromCsv } from '../src/tool/csv';
import { yearStart } from '../src/tool/dates';
import { describeTimeline, descriptionText } from '../src/tool/describe';
import { EMBED_PATH, embedCode, embedHeight, embedLink } from '../src/tool/embed';
import { engineFor } from '../src/tool/engine';
import { cleanDate, formatDate } from '../src/tool/fuzzy';
import { extentOf } from '../src/tool/layout';
import { timelineFromLink } from '../src/tool/link';
import { countItems, emptyTimeline, titleOf } from '../src/tool/model';
import { normalizeTimeline } from '../src/tool/normalize';
import { addedLine, mergeTimeline } from '../src/tool/ops';
import { SHEET_AXIS, SHEET_CHOICES, printSheets, sheetViews } from '../src/tool/print';
import { encodeDate } from '../src/tool/fuzzy';
import { escapeXml, fileSlug, pictureName, timelineSvg } from '../src/tool/svg';
import { timelineWikitext, wikiLink, wikiText } from '../src/tool/wikitext';
import { between, gregorian, random } from './helpers/engines';
import { TEST_THEME, readCsv, readXml } from './helpers/theme';

const coast = exampleById('oriental-coast')!.timeline;
const whole = (width = 1000): View => fitView(gregorian, extentOf(coast, gregorian)!, width);

/** A timeline whose every text tries to break out of whatever it is written into. */
const NASTY = '</title></svg><script>alert(1)</script> & "quotes" \'single\' {{template}} [[link]] | pipe, comma\nline =SUM(A1)';
const hostile = normalizeTimeline({
  title: NASTY,
  eras: [{ label: NASTY, from: '1', to: '50' }],
  tracks: [
    {
      name: NASTY,
      spans: [{ label: NASTY, from: '1', to: '40', text: NASTY }],
      events: [
        { title: NASTY, date: '20', text: NASTY, links: [{ label: NASTY, url: 'https://example.org/a|b[c]"d\'e{f}?x=<y>' }] },
        { title: '=HYPERLINK("https://example.org")', date: '21', text: '@cmd' },
        { title: '+1', date: '22', text: '-1' },
      ],
    },
  ],
}).timeline;

describe('the picture', () => {
  it('is a well-formed SVG of the size it says', () => {
    const { svg, width, height } = timelineSvg(coast, gregorian, whole(), { theme: TEST_THEME });
    const names = readXml(svg);
    expect(names[0]).toBe('svg');
    expect(width).toBe(24 + 150 + 1000 + 24);
    expect(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="time-title time-desc">`)).toBe(true);
    expect(svg).not.toMatch(/undefined|NaN|Infinity|\[object/);
    expect(new Set(names)).toEqual(new Set(['svg', 'title', 'desc', 'rect', 'text', 'clipPath', 'g', 'line', 'path']));
    // Nothing that could run or fetch.
    expect(svg).not.toMatch(/<script|<foreignObject|<image|<use|href=|on\w+=|style=|url\((?!#time-plot\))/);
  });

  it('carries the whole timeline in words', () => {
    const { svg } = timelineSvg(coast, gregorian, whole(), { theme: TEST_THEME });
    expect(svg).toContain('<title id="time-title">History of the Oriental Coast</title>');
    expect(svg).toContain(`<desc id="time-desc">${escapeXml(descriptionText(describeTimeline(coast, gregorian)))}</desc>`);
    // The view has a little air on both sides of 1600 to 1961.
    expect(svg).toContain('>1581 – 1979 CE</text>');
    // Every span carries its label, every event its title, every track its name, and hovering says when.
    for (const track of coast.tracks) {
      expect(svg).toContain(`>${escapeXml(track.name)}</text>`);
      // Every one is there by name for whoever hovers or listens; a span always shows its label, an event's may be cut where the next one follows.
      for (const item of [...track.spans, ...track.events]) expect(svg, titleOf(item)).toContain(`<title>${escapeXml(titleOf(item))}, `);
      for (const span of track.spans) expect(svg, span.label).toContain(`>${escapeXml(span.label)}</text>`);
    }
    expect(svg).toContain('<title>Treaty of Selunna, 1789 CE</title>');
    expect(svg).toContain('<title>House Delmaris, 1622 to 1870 CE</title>');
    expect(svg).toContain('<title>Modern era, since 1914 CE</title>');
    for (const label of ['1650', '1700', '1950']) expect(svg).toContain(`>${label}</text>`);
  });

  it('uses the colours and fonts it is handed, and nothing smaller than 13 pixels', () => {
    const { svg } = timelineSvg(coast, gregorian, whole(), { theme: TEST_THEME });
    const allowed = new Set([TEST_THEME.background, TEST_THEME.panel, TEST_THEME.ink, TEST_THEME.muted, TEST_THEME.line, TEST_THEME.lineStrong, TEST_THEME.marker, ...TEST_THEME.tones.flatMap((tone) => [tone.fill, tone.ink])]);
    const used = [...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((found) => found[1]!).filter((value) => value !== 'none');
    expect(used.length).toBeGreaterThan(50);
    for (const colour of used) expect(allowed, colour).toContain(colour);
    for (const colour of [TEST_THEME.panel, TEST_THEME.ink, TEST_THEME.muted, TEST_THEME.marker, '#0000a0', '#0000b0', '#0000a4']) expect(used).toContain(colour);
    for (const found of svg.matchAll(/font-size="(\d+)"/g)) expect(Number(found[1])).toBeGreaterThanOrEqual(13);
    expect(new Set([...svg.matchAll(/font-family="([^"]+)"/g)].map((found) => found[1]))).toEqual(new Set([TEST_THEME.sans, TEST_THEME.mono]));
  });

  it('shows what is uncertain and what goes on without leaning on colour', () => {
    const { svg } = timelineSvg(coast, gregorian, whole(), { theme: TEST_THEME });
    // c. 1640: a paler, dashed start. Since 1871 and since c. 1640: an arrowhead each. c. 1622: a hollow marker. The 1830s: a whisker ten years wide.
    expect(svg.match(/stroke-dasharray="4 3"/g)!.length).toBe(1);
    expect(svg.match(/<path d="M[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+" fill="none"/g)!.length).toBe(2);
    expect(svg.match(new RegExp(`fill="${TEST_THEME.panel}" stroke="${TEST_THEME.marker}"`, 'g'))!.length).toBe(4);
    expect(svg.match(new RegExp(`<rect [^>]*transform="rotate[^>]* fill="${TEST_THEME.marker}"/>`, 'g'))!.length).toBe(9);
    expect(svg.match(/<path d="M[-\d.]+ [\d.]+V[\d.]+H[-\d.]+V[\d.]+" fill="none"/g)!.length).toBeGreaterThanOrEqual(2);
  });

  it('can leave the heading out, and follows the view', () => {
    const plain = timelineSvg(coast, gregorian, whole(600), { theme: TEST_THEME, heading: false, gutter: 100, padding: 10 });
    expect(plain.width).toBe(10 + 100 + 600 + 10);
    expect(plain.height).toBe(timelineSvg(coast, gregorian, whole(600), { theme: TEST_THEME, gutter: 100, padding: 10 }).height - 60);
    readXml(plain.svg);
    const close: View = { start: yearStart(gregorian, 1869), end: yearStart(gregorian, 1870), width: 900 };
    const zoomed = timelineSvg(coast, gregorian, close, { theme: TEST_THEME }).svg;
    readXml(zoomed);
    expect(zoomed).toContain('>The Lantern Revolt</text>');
    expect(zoomed).not.toContain('>First orbital flight</text>');
    expect(zoomed).toContain('>Mar</text>');
    expect(zoomed).toContain('January 1869 CE – December 1869 CE');
  });

  it('escapes every text it is given', () => {
    const { svg } = timelineSvg(hostile, gregorian, fitView(gregorian, extentOf(hostile, gregorian)!, 900), { theme: TEST_THEME });
    readXml(svg);
    expect(svg).not.toContain('<script');
    expect(svg).toContain('&lt;/title&gt;&lt;/svg&gt;&lt;script&gt;');
    expect(escapeXml(`a<b>&"c'${String.fromCharCode(0)}${String.fromCharCode(8)}\n`)).toBe('a&lt;b&gt;&amp;&quot;c&#39;\n');
    const strangeFont = timelineSvg(coast, gregorian, whole(), { theme: { ...TEST_THEME, sans: '"Font", <x>' } }).svg;
    readXml(strangeFont);
  });

  it.each(EXAMPLES.map((example) => [example.id, example] as const))('%s: draws at any zoom', (_id, example) => {
    const engine = engineFor(example.timeline.calendar);
    const extent = extentOf(example.timeline, engine)!;
    const next = random(41);
    let view = fitView(engine, extent, 1000);
    for (let i = 0; i < 60; i++) {
      const { svg, width, height } = timelineSvg(example.timeline, engine, view, { theme: TEST_THEME });
      readXml(svg);
      expect(svg).not.toMatch(/undefined|NaN|Infinity|\[object/);
      expect(width).toBe(view.width + 198);
      expect(height).toBeGreaterThan(200);
      // A long track name is cut to fit its column; its start is always there.
      for (const track of example.timeline.tracks) expect(svg).toContain(`>${escapeXml(track.name.slice(0, 12))}`);
      const middle = extent.first + next() * (extent.last - extent.first);
      const length = 10 * Math.pow((extent.last - extent.first) / 5, next());
      view = clampView(engine, { start: middle - length / 2, end: middle + length / 2, width: between(next, 320, 1400) });
    }
    // The same view gives the same picture, to the letter.
    expect(timelineSvg(example.timeline, engine, view, { theme: TEST_THEME }).svg).toBe(timelineSvg(example.timeline, engine, view, { theme: TEST_THEME }).svg);
  });

  it('draws an empty timeline too', () => {
    const { svg } = timelineSvg(emptyTimeline(), gregorian, zoomView(gregorian, whole(), 2), { theme: TEST_THEME });
    readXml(svg);
    expect(svg).toContain('<title id="time-title">Untitled timeline</title>');
    expect(svg).toContain('An empty timeline.');
  });

  it('names its file', () => {
    expect(fileSlug('History of the Oriental Coast')).toBe('history-of-the-oriental-coast');
    expect(fileSlug('  Čhronicle — of / Sélunna!  ')).toBe('chronicle-of-selunna');
    expect(fileSlug('')).toBe('timeline');
    expect(fileSlug('???', 'export')).toBe('export');
    expect(fileSlug('../../etc/passwd')).toBe('etc-passwd');
    // A picture is named for what the browser really made.
    expect(pictureName('khara', undefined, 'image/png')).toBe('khara.png');
    expect(pictureName('khara', 'square', 'image/webp')).toBe('khara-square.webp');
    expect(pictureName('khara', '', 'image/webp')).toBe('khara.webp');
    expect(pictureName('khara', 'story', 'image/png')).toBe('khara-story.png');
    expect(pictureName('khara', undefined, '')).toBe('khara.png');
  });
});

describe('the picture with two calendars', () => {
  it('labels the axis in both, and says which row is which', () => {
    const selunna = exampleById('selunna')!.timeline;
    const engine = engineFor(selunna.calendar);
    const view: View = { start: yearStart(engine, 300), end: yearStart(engine, 800), width: 1000 };
    const one = timelineSvg(selunna, engine, view, { theme: TEST_THEME });
    const two = timelineSvg(selunna, engine, view, { theme: TEST_THEME, also: gregorian });
    readXml(two.svg);
    expect(two.height).toBe(one.height + 22);
    expect(two.width).toBe(one.width);
    // Year 500 FS is 1506 CE: each calendar has round numbers of its own.
    for (const label of ['400', '500', '600', '700']) expect(two.svg).toContain(`>${label}</text>`);
    for (const label of ['1400', '1500', '1600', '1700']) {
      expect(two.svg).toContain(`>${label}</text>`);
      expect(one.svg).not.toContain(`>${label}</text>`);
    }
    expect(two.svg).toContain('>Selunnan Reckoning</text>');
    expect(two.svg).toContain('>Gregorian calendar</text>');
    expect(one.svg).not.toContain('>Gregorian calendar</text>');
    expect(timelineSvg(selunna, engine, view, { theme: TEST_THEME, also: null }).svg).toBe(one.svg);
  });
});

describe('the wiki table', () => {
  it('is a sortable wikitable with a row for everything, earliest first', () => {
    const text = timelineWikitext(coast, gregorian);
    const lines = text.split('\n');
    expect(lines.slice(0, 6)).toEqual([
      '{| class="wikitable sortable"',
      '|+ History of the Oriental Coast',
      '! scope="col" | Date',
      '! scope="col" | Track',
      '! scope="col" | What happened',
      '! scope="col" class="unsortable" | Notes',
    ]);
    expect(lines.at(-1)).toBe('|}');
    const count = countItems(coast);
    expect(lines.filter((line) => line === '|-').length).toBe(count.eras + count.spans + count.events);
    const sortValues = [...text.matchAll(/data-sort-value="(-?\d+)"/g)].map((found) => Number(found[1]));
    expect(sortValues.length).toBe(count.eras + count.spans + count.events);
    for (let i = 1; i < sortValues.length; i++) expect(sortValues[i]).toBeGreaterThanOrEqual(sortValues[i - 1]!);
    expect(text).toContain(
      ['|-', `| data-sort-value="${yearStart(gregorian, 1789)}" | 1789 CE`, '| Coastal League', "| '''Treaty of Selunna'''", '| Ends the Coastal War. Teland cedes the Ostaril isles; the League gains free passage through the straits. [https://eurth.org/ Eurth forums]'].join('\n'),
    );
    expect(text).toContain(["| 1600 to 1820 CE", "| ''Era''", "| '''Age of Sail''' (220 years)", '| '].join('\n'));
    expect(text).toContain("| '''House Delmaris''' (248 years)");
  });

  it('lets no text act as markup', () => {
    expect(wikiText('Plain words, with a comma.')).toBe('Plain words, with a comma.');
    expect(wikiText('a|b')).toBe('<nowiki>a|b</nowiki>');
    expect(wikiText('{{delete}}')).toBe('<nowiki>{{delete}}</nowiki>');
    expect(wikiText("it''s")).toBe("<nowiki>it''s</nowiki>");
    expect(wikiText('</nowiki>[[x]]')).toBe('<nowiki>&lt;/nowiki&gt;[[x]]</nowiki>');
    expect(wikiText('AT&T')).toBe('<nowiki>AT&amp;T</nowiki>');
    expect(wikiText('* a list')).toBe('<nowiki>* a list</nowiki>');
    expect(wikiText('see https://eurth.org')).toBe('<nowiki>see https://eurth.org</nowiki>');
    expect(wikiLink('Wiki | page', 'https://example.org/a|b[c] d')).toBe('[https://example.org/a%7Cb%5Bc%5D%20d <nowiki>Wiki | page</nowiki>]');
    const text = timelineWikitext(hostile, gregorian);
    const outside = text.replace(/<nowiki>[\s\S]*?<\/nowiki>/g, '');
    expect(outside).not.toMatch(/\{\{|\[\[|<script|template|SUM/);
    expect(text.match(/<nowiki>/g)!.length).toBe(text.match(/<\/nowiki>/g)!.length);
    // The table keeps its shape: four cells to a row.
    for (const block of outside.split('\n|-\n').slice(1)) expect(block.replace(/\n\|\}$/, '').split('\n').length, block).toBe(4);
  });

  it.each(EXAMPLES.map((example) => [example.id, example] as const))('%s: has every title and every date in its own calendar', (_id, example) => {
    const engine = engineFor(example.timeline.calendar);
    const text = timelineWikitext(example.timeline, engine);
    for (const track of example.timeline.tracks) {
      for (const event of track.events) {
        expect(text).toContain(`'''${event.title}'''`);
        expect(text).toContain(formatDate(engine, event.date));
      }
      for (const span of track.spans) expect(text).toContain(`'''${wikiText(span.label)}'''`);
    }
    expect(text).not.toMatch(/undefined|NaN|\[object/);
  });
});

describe('the spreadsheet', () => {
  it('has a row for everything, with dates in words and in code', () => {
    const rows = readCsv(timelineCsv(coast, gregorian));
    const count = countItems(coast);
    expect(rows[0]).toEqual([...CSV_COLUMNS]);
    expect(rows.length).toBe(1 + count.eras + count.spans + count.events);
    for (const row of rows) expect(row.length).toBe(CSV_COLUMNS.length);
    expect(rows[1]).toEqual(['era', '', 'Age of Sail', '1600 CE', '1820 CE', '1600', '1820', '220 years', '', '', '', '']);
    expect(rows.find((row) => row[2] === 'Republic of Teland')).toEqual(['span', 'Teland', 'Republic of Teland', '1871 CE', '', '1871', '', '', coast.tracks[0]!.spans[1]!.text, '', '', '']);
    expect(rows.find((row) => row[2] === 'Treaty of Selunna')).toEqual(['event', 'Coastal League', 'Treaty of Selunna', '1789 CE', '1789 CE', '1789', '1789', '', coast.tracks[2]!.events[1]!.text, 'https://eurth.org/', '', '']);
    expect(rows.find((row) => row[2] === 'Vasil I is crowned')!.slice(3, 7)).toEqual(['c. 1640 CE', 'c. 1640 CE', '~1640', '~1640']);
    expect(timelineCsv(coast, gregorian).endsWith('\r\n')).toBe(true);
    expect(timelineCsv(emptyTimeline(), gregorian)).toBe(`${CSV_COLUMNS.join(',')}\r\n`);
  });

  it('quotes what needs quoting and disarms formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell('-5', false)).toBe('-5');
    const rows = readCsv(timelineCsv(hostile, gregorian));
    for (const row of rows) expect(row.length).toBe(CSV_COLUMNS.length);
    for (const row of rows.slice(1)) for (const cell of [row[1]!, row[2]!, row[8]!]) expect(cell).not.toMatch(/^[=+\-@]/);
    expect(rows.find((row) => row[5] === '21')![2]).toBe('\'=HYPERLINK("https://example.org")');
    expect(rows.find((row) => row[5] === '22')!.slice(2, 9)).toEqual(["'+1", '22 CE', '22 CE', '22', '22', '', "'-1"]);
  });

  it.each(EXAMPLES.map((example) => [example.id, example] as const))('%s: every code reads back as its date', (_id, example) => {
    const engine = engineFor(example.timeline.calendar);
    const rows = readCsv(timelineCsv(example.timeline, engine)).slice(1);
    const count = countItems(example.timeline);
    expect(rows.length).toBe(count.eras + count.spans + count.events);
    for (const row of rows) {
      const from = cleanDate(engine, row[5]!)!;
      expect(from.changed).toBe(false);
      expect(formatDate(engine, from.date)).toBe(row[3]);
      if (row[6] !== '') expect(formatDate(engine, cleanDate(engine, row[6]!)!.date)).toBe(row[4]);
      else expect(row[4]).toBe('');
    }
  });
});

describe('a sheet read back', () => {
  /** A timeline as a sheet can carry it: what is on which track and when, without tones, kinds or order. */
  const essence = (timeline: typeof coast) => ({
    eras: timeline.eras.map((era) => [era.label, encodeDate(era.from), era.to === null ? '' : encodeDate(era.to)].join('|')).sort(),
    tracks: timeline.tracks.map((track) => ({
      name: track.name,
      group: track.group,
      spans: track.spans.map((span) => [span.label, encodeDate(span.from), span.to === null ? '' : encodeDate(span.to), span.text, span.links.map((link) => link.url).join(' ')].join('|')).sort(),
      events: track.events.map((event) => [event.title, encodeDate(event.date), event.text, event.links.map((link) => link.url).join(' ')].join('|')).sort(),
    })),
  });

  it.each(EXAMPLES.map((example) => [example.id, example] as const))('%s: comes back from its own export', (_id, example) => {
    const engine = engineFor(example.timeline.calendar);
    const read = timelineFromCsv(timelineCsv(example.timeline, engine), example.timeline.calendar)!;
    expect(read.issues).toEqual([]);
    const count = countItems(example.timeline);
    expect(read.rows).toBe(count.eras + count.spans + count.events);
    expect(essence(read.timeline)).toEqual(essence(example.timeline));
    expect(read.timeline.calendar).toEqual(example.timeline.calendar);
  });

  it('reads a sheet typed by hand, with dates in words', () => {
    const sheet = ['Date,End,Name,Track,Notes', '1789,,Treaty of Selunna,Coastal League,Ends the war', '1702,1789,Coastal War,Coastal League,', 'c. 1640,,Vasil I is crowned,Ostaril,', '"12 April 1961",,"First ""orbital"" flight",,'].join('\n');
    const read = timelineFromCsv(sheet)!;
    expect(read.issues).toEqual([]);
    expect(read.timeline.tracks.map((track) => track.name)).toEqual(['Coastal League', 'Ostaril', 'Imported']);
    expect(read.timeline.tracks[0]!.events.map((event) => [event.title, encodeDate(event.date), event.text])).toEqual([['Treaty of Selunna', '1789', 'Ends the war']]);
    expect(read.timeline.tracks[0]!.spans.map((span) => [span.label, encodeDate(span.from), encodeDate(span.to!)])).toEqual([['Coastal War', '1702', '1789']]);
    expect(encodeDate(read.timeline.tracks[1]!.events[0]!.date)).toBe('~1640');
    expect(read.timeline.tracks[2]!.events[0]).toMatchObject({ title: 'First "orbital" flight', date: { year: 1961, month: 4, day: 12 } });
    // In another calendar the same words mean that calendar's dates.
    const selunnan = timelineFromCsv('title,from\nThe Founding,1 Frostmoon 1 FS\nMidyear,Midyear Day 1020 FS', exampleById('selunna')!.timeline.calendar)!;
    expect(selunnan.timeline.tracks[0]!.events.map((event) => encodeDate(event.date))).toEqual(['1-1-1', '1020-i1-1']);
  });

  it('takes the type from the sheet, an open end for a span, and links', () => {
    const sheet = 'type,track,title,from_code,to_code,links\r\nera,,Age of Sail,1600,1820,\r\nspan,Teland,Republic,1871,,https://eurth.org/a https://eurth.org/b\r\nevent,Teland,Vote,1923,1930,\r\n';
    const read = timelineFromCsv(sheet)!;
    expect(read.timeline.eras).toEqual([{ label: 'Age of Sail', from: { year: 1600 }, to: { year: 1820 } }]);
    expect(read.timeline.tracks[0]!.spans[0]).toMatchObject({ label: 'Republic', to: null });
    expect(read.timeline.tracks[0]!.spans[0]!.links.map((link) => link.url)).toEqual(['https://eurth.org/a', 'https://eurth.org/b']);
    // An event is a single date, whatever the sheet put in its end column.
    expect(read.timeline.tracks[0]!.events.map((event) => encodeDate(event.date))).toEqual(['1923']);
  });

  it('undoes the apostrophe the export puts before a would-be formula', () => {
    const read = timelineFromCsv(timelineCsv(hostile, gregorian))!;
    expect(essence(read.timeline)).toEqual(essence(hostile));
    expect(read.timeline.tracks[0]!.events.map((event) => event.title)).toContain('=HYPERLINK("https://example.org")');
  });

  it('leaves out what it cannot date, and says so', () => {
    const read = timelineFromCsv('title,from\nKnown,1650\nUnknown,some time ago\nNonsense,31 February 1700\n,1700')!;
    expect(read.rows).toBe(4);
    expect(read.timeline.tracks[0]!.events.map((event) => event.title)).toEqual(['Known', 'Untitled event']);
    expect(read.issues.length).toBe(2);
  });

  it('gives nothing for what is not a timeline sheet, and never throws', () => {
    for (const junk of [null, 7, '', '\n\n', 'just some words', 'a,b,c\n1,2,3', 'title\nNo date column', 'from\n1650', `title,from\n${'x'.repeat(MAX_CSV_LENGTH)}`]) expect(timelineFromCsv(junk), String(junk).slice(0, 20)).toBeNull();
    expect(timelineFromCsv('title,from')!.timeline).toEqual(emptyTimeline());
    expect(parseCsv('\uFEFFa,b\n"c\nd",e\n\n ,\n"unclosed,f')).toEqual([['a', 'b'], ['c\nd', 'e'], ['unclosed,f']]);
    expect(parseCsv('a,"b"c",d')).toEqual([['a', 'bc"', 'd']]);
  });
});

describe('one timeline brought into another', () => {
  const extra = normalizeTimeline({
    eras: [{ label: 'Age of Sail', from: '1600', to: '1820' }, { label: 'Age of Steam', from: '1830', to: '1900' }],
    tracks: [
      { name: 'TELAND', events: [{ title: 'The Lantern Revolt', date: '1869-3-18' }, { title: 'The harbour freezes', date: '1740' }], spans: [{ label: 'House Delmaris', from: '1622', to: '1870' }] },
      { name: 'Ardenmark', kind: 'nation', events: [{ title: 'Founded', date: '1699' }] },
    ],
  }).timeline;

  it('adds what is new, to the track of the same name or as a new track', () => {
    const { timeline, added } = mergeTimeline(coast, extra);
    expect(added).toEqual({ tracks: 1, spans: 0, events: 2, eras: 1 });
    expect(addedLine(added)).toBe('1 track, 2 events and 1 era');
    expect(timeline.tracks.map((track) => track.name)).toEqual([...coast.tracks.map((track) => track.name), 'Ardenmark']);
    expect(timeline.tracks[0]!.events.map((event) => event.title)).toEqual([...coast.tracks[0]!.events.map((event) => event.title), 'The harbour freezes']);
    expect(timeline.tracks[0]!.spans).toEqual(coast.tracks[0]!.spans);
    expect(timeline.eras.map((era) => era.label)).toEqual(['Age of Sail', 'Industrial age', 'Modern era', 'Age of Steam']);
    expect(normalizeTimeline(timeline).issues).toEqual([]);
    // Neither timeline is changed.
    expect(coast.tracks.length).toBe(4);
    expect(extra.tracks[0]!.events.length).toBe(2);
  });

  it('adds nothing twice', () => {
    const once = mergeTimeline(coast, extra).timeline;
    const twice = mergeTimeline(once, extra);
    expect(twice.added).toEqual({ tracks: 0, spans: 0, events: 0, eras: 0 });
    expect(addedLine(twice.added)).toBe('nothing new');
    expect(twice.timeline).toEqual(once);
    expect(mergeTimeline(coast, coast).timeline).toEqual(coast);
    expect(addedLine({ tracks: 0, spans: 1, events: 0, eras: 0 })).toBe('1 span');
    // The timeline being added to keeps its own title and calendar.
    expect(mergeTimeline(emptyTimeline(), coast).timeline).toEqual({ ...coast, title: '' });
  });
});

describe('the timeline on paper', () => {
  const range = { first: yearStart(gregorian, 1600), last: yearStart(gregorian, 2000) };

  it('cuts the stretch into sheets that follow one another', () => {
    for (const count of SHEET_CHOICES) {
      const views = sheetViews(range, count);
      expect(views.length).toBe(count);
      expect(views[0]!.start).toBe(range.first);
      expect(views.at(-1)!.end).toBeCloseTo(range.last, 6);
      for (let i = 1; i < views.length; i++) expect(views[i]!.start).toBeCloseTo(views[i - 1]!.end, 9);
      for (const view of views) expect(view.width).toBe(SHEET_AXIS);
    }
    expect(sheetViews(range, 0).length).toBe(1);
    expect(sheetViews(range, 99).length).toBe(12);
    expect(sheetViews(range, NaN).length).toBe(1);
    expect(sheetViews({ first: 5, last: 5 }, 3).every((view) => view.end > view.start)).toBe(true);
  });

  it('draws each sheet as a picture of its own, with its place in the run', () => {
    const sheets = printSheets(coast, gregorian, range, 4, TEST_THEME);
    expect(sheets.map((sheet) => sheet.label)).toEqual([1, 2, 3, 4].map((n) => `History of the Oriental Coast, sheet ${n} of 4`));
    expect(sheets[0]!.svg).toContain('>1600 – 1699 CE · sheet 1 of 4</text>');
    sheets.forEach((sheet, i) => {
      readXml(sheet.svg);
      expect(sheet.width).toBe(SHEET_AXIS + 198);
      // Sheets are equal in days, so a sheet may begin a day short of the century.
      expect(sheet.svg).toMatch(new RegExp(`>1[5-9]\\d\\d – 1[6-9]\\d\\d CE · sheet ${i + 1} of 4</text>`));
      expect(sheet.svg).not.toMatch(/undefined|NaN/);
    });
    // Spread wider, labels that had no room find some: the treaty is cut short on one sheet and whole on four.
    expect(sheets[1]!.svg).toContain('>Treaty of Selunna</text>');
    expect(sheets[3]!.svg).toContain('>First orbital flight</text>');
    expect(sheets[0]!.svg).not.toContain('>First orbital flight</text>');
  });

  it('says nothing of sheets when there is only one', () => {
    const [only] = printSheets(coast, gregorian, range, 1, TEST_THEME);
    expect(only!.label).toBe('History of the Oriental Coast');
    expect(only!.svg).toContain('>1600 – 1999 CE</text>');
    expect(only!.svg).not.toContain('sheet');
    expect(printSheets(emptyTimeline(), gregorian, range, 2, TEST_THEME).map((sheet) => sheet.label)).toEqual(['Timeline, sheet 1 of 2', 'Timeline, sheet 2 of 2']);
  });
});

describe('the embed', () => {
  it('is one iframe to the embed page, with the timeline in its link', () => {
    const link = embedLink('https://time.eurth.org/', coast);
    expect(link.startsWith(`https://time.eurth.org/${EMBED_PATH}?t=1.`)).toBe(true);
    expect(timelineFromLink(link)!.timeline).toEqual(coast);
    const height = embedHeight(coast, gregorian);
    expect(height).toBeGreaterThanOrEqual(320);
    expect(height).toBeLessThanOrEqual(1200);
    expect(embedHeight(emptyTimeline(), gregorian)).toBe(320);
    const code = embedCode(link, coast.title, height);
    expect(code).toBe(`<iframe src="${link}" title="History of the Oriental Coast: a timeline" width="100%" height="${height}" loading="lazy" style="border:0;max-width:100%"></iframe>`);
    expect(readXml(code)).toEqual(['iframe']);
    expect(code).not.toMatch(/<script|allow=|srcdoc/);
  });

  it('escapes its title and keeps the calendar', () => {
    const code = embedCode('https://time.eurth.org/embed/?t=1.a&cal=1.b', '"><script>x</script>', 400.4);
    expect(readXml(code)).toEqual(['iframe']);
    expect(code).toContain('src="https://time.eurth.org/embed/?t=1.a&amp;cal=1.b"');
    expect(code).toContain('title="&quot;&gt;&lt;script&gt;x&lt;/script&gt;: a timeline"');
    expect(code).toContain('height="400"');
    expect(embedCode('https://time.eurth.org/embed/', '  ', 320)).toContain('title="Timeline"');
    const khara = exampleById('khara')!.timeline;
    expect(new URL(embedLink('https://time.eurth.org/', khara)).searchParams.has('cal')).toBe(true);
  });
});
