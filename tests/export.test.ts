import { describe, expect, it } from 'vitest';
import { EXAMPLES, exampleById } from '../src/content/examples';
import { clampView, fitView, zoomView, type View } from '../src/time/axis';
import { CSV_COLUMNS, csvCell, timelineCsv } from '../src/time/csv';
import { yearStart } from '../src/time/dates';
import { describeTimeline, descriptionText } from '../src/time/describe';
import { EMBED_PATH, embedCode, embedHeight, embedLink } from '../src/time/embed';
import { engineFor } from '../src/time/engine';
import { cleanDate, formatDate } from '../src/time/fuzzy';
import { extentOf } from '../src/time/layout';
import { timelineFromLink } from '../src/time/link';
import { countItems, emptyTimeline, titleOf } from '../src/time/model';
import { normalizeTimeline } from '../src/time/normalize';
import { escapeXml, fileSlug, timelineSvg } from '../src/time/svg';
import { timelineWikitext, wikiLink, wikiText } from '../src/time/wikitext';
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
    expect(svg.match(/<path d="M[-\d.]+ [\d.]+V[\d.]+M/g)!.length).toBeGreaterThanOrEqual(2);
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
    expect(rows[1]).toEqual(['era', '', 'Age of Sail', '1600 CE', '1820 CE', '1600', '1820', '220 years', '', '']);
    expect(rows.find((row) => row[2] === 'Republic of Teland')).toEqual(['span', 'Teland', 'Republic of Teland', '1871 CE', '', '1871', '', '', coast.tracks[0]!.spans[1]!.text, '']);
    expect(rows.find((row) => row[2] === 'Treaty of Selunna')).toEqual(['event', 'Coastal League', 'Treaty of Selunna', '1789 CE', '1789 CE', '1789', '1789', '', coast.tracks[2]!.events[1]!.text, 'https://eurth.org/']);
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
