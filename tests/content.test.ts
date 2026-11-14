import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../src/content/examples';
import { GLOSSARY_DESCRIPTION, GLOSSARY_TITLE, TERMS } from '../src/content/glossary';
import { CHECKLIST, DURATIONS, GUIDE_DESCRIPTION, GUIDE_LEAD, GUIDE_SECTIONS, GUIDE_TITLE, GUIDE_UPDATED, SOURCES } from '../src/content/guide';
import { describeTimeline, descriptionText } from '../src/time/describe';
import { engineFor } from '../src/time/engine';

/** Every word a visitor reads in the guide, the glossary and the examples. */
const guideText = [GUIDE_TITLE, GUIDE_DESCRIPTION, GUIDE_LEAD, ...GUIDE_SECTIONS.flatMap((section) => [section.heading, ...section.paragraphs, ...(section.points ?? [])]), ...DURATIONS.flatMap((row) => [row.what, row.took, row.note]), ...SOURCES.map((source) => source.citation), ...CHECKLIST];
const glossaryText = [GLOSSARY_TITLE, GLOSSARY_DESCRIPTION, ...TERMS.flatMap((term) => [term.term, term.definition])];
const exampleText = EXAMPLES.flatMap((example) => [example.pitch, descriptionText(describeTimeline(example.timeline, engineFor(example.timeline.calendar)))]);
const everything = [...guideText, ...glossaryText, ...exampleText];

describe('the house style', () => {
  it('is British English', () => {
    const american = /\b(color|colors|center|centers|honor|labor|neighbor|neighbors|favorite|theater|program(?!m)|traveled|traveling|organiz|realiz|recogniz|civiliz|gray|defense|catalog\b|while\s+away)/i;
    for (const text of everything) expect(text, text.slice(0, 60)).not.toMatch(american);
  });

  it('has no emoji, no double spaces and no placeholder text', () => {
    for (const text of everything) {
      expect(text, text.slice(0, 60)).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(text, text.slice(0, 60)).not.toMatch(/ {2}|\t|TODO|lorem|undefined|\[object/i);
      expect(text.trim()).toBe(text);
    }
  });

  it('writes sentences', () => {
    for (const text of [GUIDE_LEAD, ...GUIDE_SECTIONS.flatMap((section) => [...section.paragraphs, ...(section.points ?? [])]), ...DURATIONS.map((row) => row.note), ...TERMS.map((term) => term.definition), ...EXAMPLES.map((example) => example.pitch)]) {
      expect(text, text.slice(0, 60)).toMatch(/^["A-Z0-9].*[.?!"]$/s);
    }
    for (const heading of [GUIDE_TITLE, GLOSSARY_TITLE, ...GUIDE_SECTIONS.map((section) => section.heading)]) {
      // Sentence case: no capital after the first word, but for names.
      expect(heading).toMatch(/^[A-Z]/);
      expect(heading.split(' ').slice(1).filter((word) => /^[A-Z]/.test(word))).toEqual([]);
    }
  });
});

describe('the guide', () => {
  it('covers what the brief asks: causes, parallel tracks, how long things take, with sources', () => {
    expect(GUIDE_SECTIONS.map((section) => section.id)).toEqual(['backwards', 'causes', 'tracks', 'speeds', 'durations', 'doubt', 'gaps']);
    expect(new Set(GUIDE_SECTIONS.map((section) => section.id)).size).toBe(GUIDE_SECTIONS.length);
    for (const section of GUIDE_SECTIONS) {
      expect(section.id).toMatch(/^[a-z][a-z-]*$/);
      expect(section.paragraphs.length).toBeGreaterThanOrEqual(2);
    }
    const words = GUIDE_SECTIONS.flatMap((section) => section.paragraphs).join(' ').split(/\s+/).length;
    expect(words).toBeGreaterThan(700);
    expect(words).toBeLessThan(1600);
    expect(GUIDE_UPDATED).toMatch(/^\d{4}-\d\d-\d\d$/);
    expect(Number.isNaN(Date.parse(GUIDE_UPDATED))).toBe(false);
    expect(GUIDE_DESCRIPTION.length).toBeGreaterThanOrEqual(50);
    expect(GUIDE_DESCRIPTION.length).toBeLessThanOrEqual(200);
    expect(CHECKLIST.length).toBeGreaterThanOrEqual(5);
    for (const question of CHECKLIST) expect(question).toMatch(/\?$/);
  });

  it('gives a source for every figure in the table', () => {
    const ids = new Set(SOURCES.map((source) => source.id));
    expect(ids.size).toBe(SOURCES.length);
    expect(DURATIONS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(DURATIONS.map((row) => row.kind))).toEqual(new Set(['Reigns', 'Dynasties', 'Wars', 'Building', 'Journeys and news', 'Change']));
    for (const row of DURATIONS) {
      expect(row.sources.length).toBeGreaterThan(0);
      for (const id of row.sources) expect(ids, `${row.what}: ${id}`).toContain(id);
      expect(row.took).toMatch(/\d|hour|year|week|generation|Four/);
    }
    // Rows of one kind stay together, so the table can be grouped.
    const kinds = DURATIONS.map((row) => row.kind);
    expect(kinds.filter((kind, i) => kind !== kinds[i - 1]).length).toBe(new Set(kinds).size);
  });

  it('cites books and pages that can be found', () => {
    expect(SOURCES.length).toBeGreaterThanOrEqual(12);
    for (const source of SOURCES) {
      expect(source.id).toMatch(/^[a-z][a-z-]*$/);
      expect(source.citation).toMatch(/\.$/);
      if (source.url !== undefined) expect(source.url).toMatch(/^https:\/\/[!-~]+$/);
      if (source.wikipedia !== undefined) expect(source.wikipedia).toMatch(/^[A-Z][\w' -]+$/);
      // A book has a publisher and a year; anything else has somewhere to go.
      expect(/\(\S.*\d{4}.*\)/.test(source.citation) || source.url !== undefined || source.wikipedia !== undefined, source.id).toBe(true);
    }
    // The historians the guide names are in the list.
    for (const name of ['Carr', 'Braudel', 'Priestley']) {
      expect(GUIDE_SECTIONS.flatMap((section) => section.paragraphs).join(' ')).toContain(name);
      expect(SOURCES.some((source) => source.citation.includes(name))).toBe(true);
    }
  });

  it('never names another Eurth tool, launched or not', () => {
    // What a site says about other tools is decided when it is built, from the list in @eurth/style.
    for (const text of [...everything, JSON.stringify(EXAMPLES)]) expect(text).not.toMatch(/\b(?!time\.)[a-z]+\.eurth\.org/);
  });
});

describe('the glossary', () => {
  it('has some thirty terms in alphabetical order, each with its own id', () => {
    expect(TERMS.length).toBeGreaterThanOrEqual(28);
    expect(new Set(TERMS.map((term) => term.id)).size).toBe(TERMS.length);
    const names = TERMS.map((term) => term.term.toLowerCase());
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
    for (const term of TERMS) {
      expect(term.id).toMatch(/^[a-z][a-z-]*$/);
      expect(term.id).toBe(
        term.term
          .toLowerCase()
          .normalize('NFD')
          .replace(/[^a-z ]/g, '')
          .trim()
          .replace(/ +/g, '-'),
      );
      expect(term.definition.length).toBeGreaterThan(40);
      expect(term.definition.length).toBeLessThanOrEqual(320);
    }
    expect(GLOSSARY_DESCRIPTION.length).toBeGreaterThanOrEqual(50);
    expect(GLOSSARY_DESCRIPTION.length).toBeLessThanOrEqual(200);
  });

  it('explains the words the tool and the guide lean on', () => {
    const ids = TERMS.map((term) => term.id);
    for (const id of ['track', 'span', 'event', 'era', 'circa', 'epoch', 'regnal-year', 'interregnum', 'floruit', 'anachronism', 'intercalary-day', 'year-zero']) expect(ids).toContain(id);
  });
});
