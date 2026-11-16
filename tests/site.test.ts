// The built pages, as a visitor and a search engine get them before any script has run. They
// read dist/, so run "npm run build" first (CI does); without a build they are skipped.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createProfile, getSection, parseProfile, serialiseProfile, setSection, validateProfile } from '@eurth/profile';
import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../src/content/examples';
import { TERMS } from '../src/content/glossary';
import { DURATIONS, GUIDE_SECTIONS, SOURCES } from '../src/content/guide';
import { describeTimeline } from '../src/tool/describe';
import { engineFor } from '../src/tool/engine';
import { timelineFromLink, timelineLink } from '../src/tool/link';
import { countItems, titleOf } from '../src/tool/model';
import { readProfile, toProfileSection } from '../src/tool/profile';

const dist = join(import.meta.dirname, '..', 'dist');
const built = existsSync(join(dist, 'index.html'));
const page = (path: string): string => readFileSync(join(dist, path, 'index.html'), 'utf8');
const text = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ');

describe.skipIf(!built)('the timeline page, before any script runs', () => {
  const start = EXAMPLES[0]!.timeline;

  it('draws the starting timeline as a list to choose from', () => {
    const html = page('');
    const count = countItems(start);
    expect(html).toMatch(/role="listbox"[^>]*aria-label="Timeline: History of the Oriental Coast"/);
    expect(html.match(/role="option"/g)!.length).toBe(count.eras + count.spans + count.events);
    expect(html.match(/role="group"/g)!.length).toBe(1 + count.tracks);
    // Every option says what it is and when.
    expect(html).toContain('aria-label="Treaty of Selunna, 1789 CE"');
    expect(html).toContain('aria-label="House Delmaris, 1622 to 1870 CE, 248 years"');
    expect(html).toContain('aria-label="Kingdom of Ostaril · House Varenko, since c. 1640 CE"');
  });

  it('has the whole timeline as words, with a button for every thing', () => {
    const words = text(page(''));
    expect(words).toContain(describeTimeline(start, engineFor(start.calendar)).summary);
    for (const track of start.tracks) {
      for (const item of [...track.spans, ...track.events]) {
        expect(words).toContain(titleOf(item));
        if (item.text !== '') expect(words).toContain(item.text);
      }
    }
    for (const era of start.eras) expect(page('')).toContain(`>${era.label}</button>`);
  });

  it('has one h1, the tools, and no editing on the embed page', () => {
    const index = page('');
    const embed = page('embed');
    expect(index).toContain('<h1');
    for (const label of ['Add event', 'Add span', 'Add era', 'Add track', 'Undo', 'Redo', 'WebP', 'Copy wiki table', 'Copy embed code', 'Load profile', 'Save profile', 'Copy link', 'Copy description']) {
      expect(text(index), label).toContain(label);
      expect(text(embed), label).not.toContain(label);
    }
    expect(text(embed)).toContain('There is no timeline in this link.');
    expect(embed).not.toContain('role="listbox"');
  });
});

describe.skipIf(!built)('the other pages', () => {
  it('link each example into the tool, in its own calendar', () => {
    const html = page('examples');
    const links = [...html.matchAll(/<a class="eu-card" href="([^"]+)"/g)].map((found) => found[1]!.replace(/&amp;|&#38;/g, '&'));
    expect(links.length).toBe(EXAMPLES.length);
    expect(links[0]).toBe('/');
    EXAMPLES.slice(1).forEach((example, i) => {
      const read = timelineFromLink(links[i + 1]!)!;
      expect(read.issues).toEqual([]);
      expect(read.timeline).toEqual(example.timeline);
      expect(links[i + 1]).toBe(`/${new URL(timelineLink('https://time.eurth.org/', example.timeline, true)).search}`);
    });
    // Each has its picture, and the picture says what it shows.
    expect(html.match(/<img src="data:image\/svg\+xml/g)!.length).toBe(EXAMPLES.length);
    for (const example of EXAMPLES) expect(text(html)).toContain(example.pitch);
  });

  it('carry the guide, its table and its sources', () => {
    const html = page('guide');
    const words = text(html);
    for (const section of GUIDE_SECTIONS) {
      expect(html).toContain(`<h2 id="${section.id}"`);
      expect(words).toContain(section.paragraphs[0]!);
    }
    expect(html.match(/<tr/g)!.length).toBe(1 + new Set(DURATIONS.map((row) => row.kind)).size + DURATIONS.length);
    for (const source of SOURCES) expect(html).toContain(`id="source-${source.id}"`);
    expect(html).toMatch(/<time datetime="\d{4}-\d\d-\d\d"[^>]*>\d{1,2} [A-Z][a-z]+ \d{4}<\/time>/);
    // Links to other sites say where the visitor came from.
    for (const found of html.matchAll(/href="(https:\/\/(?:en\.wikipedia\.org|orbis\.stanford\.edu)[^"]*)"/g)) expect(found[1]).toContain('ref=time.eurth.org');
    expect(html).toContain('"@type":"Article"');
  });

  it('carry the glossary, with an anchor for every term', () => {
    const html = page('glossary');
    for (const term of TERMS) expect(html).toContain(`<dt id="${term.id}"`);
    expect(html).toContain('"@type":"DefinedTermSet"');
    expect(html).toContain('lang="fr"');
  });

  it('are the six pages and nothing more', () => {
    const pages: string[] = [];
    const walk = (dir: string, under = '') => {
      for (const name of readdirSync(dir)) {
        if (statSync(join(dir, name)).isDirectory()) walk(join(dir, name), `${under}${name}/`);
        else if (name.endsWith('.html')) pages.push(`${under}${name}`);
      }
    };
    walk(dist);
    expect(pages.sort()).toEqual(['404.html', 'embed/index.html', 'examples/index.html', 'glossary/index.html', 'guide/index.html', 'index.html']);
  });
});

describe('the profile file, with the real @eurth/profile', () => {
  it.each(EXAMPLES.map((example) => [example.id, example] as const))('%s: saves as a valid profile and loads back', (_id, example) => {
    const link = timelineLink('https://time.eurth.org/', example.timeline, true);
    const profile = setSection(createProfile('Example'), 'timeline', toProfileSection(example.timeline, { link }));
    const checked = validateProfile(profile);
    expect(checked.ok ? [] : checked.errors).toEqual([]);
    // Through the file and back.
    const parsed = parseProfile(serialiseProfile(profile));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const read = readProfile(parsed.profile);
    expect(read.found).toBe(true);
    expect(read.issues).toEqual([]);
    expect(read.timeline).toEqual(example.timeline);
  });

  it('leaves every other section exactly as it was', () => {
    const before = setSection(setSection(createProfile('Selunna'), 'flag', { summary: 'A flag.', colours: ['#ffffff'] }), 'someNewTool', { anything: [1, 2, 3] });
    const after = setSection(before, 'timeline', { ...getSection(before, 'timeline'), ...toProfileSection(EXAMPLES[1]!.timeline) });
    expect(validateProfile(after).ok).toBe(true);
    expect(getSection(after, 'flag')).toEqual(getSection(before, 'flag'));
    expect(getSection(after, 'someNewTool')).toEqual(getSection(before, 'someNewTool'));
    expect(Object.keys(after)).toEqual(['meta', 'flag', 'someNewTool', 'timeline']);
  });
});
