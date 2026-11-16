/**
 * The timeline as a wiki table, for the history section of a nation's article: a sortable
 * wikitable with a row for every era, span and event, earliest first. Paste it into IIWiki or
 * any MediaWiki site.
 *
 * Wikitext is a language, and a timeline's texts are someone else's input: every title and text
 * is wrapped in <nowiki> when it holds anything the wiki would read as markup, so a title can't
 * break the table or pull in a template.
 */
import { describeTimeline, type DescribedItem } from './describe';
import type { DateEngine } from './engine';
import type { Timeline } from './model';

/** Text as the wiki should show it, letter for letter. */
export function wikiText(text: string): string {
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Anything that could start markup: brackets, braces, pipes, quotes in pairs, equals, tildes, underscores in pairs,
  // entities, list markers at the start, and bare addresses.
  const risky = /[[\]{}|=~]|''|__|&|^[*#:; !-]|:\/\//.test(text);
  return risky ? `<nowiki>${safe}</nowiki>` : safe;
}

/** A link as wikitext: [https://example.org label]. */
export function wikiLink(label: string, url: string): string {
  const address = url.replace(/[[\]|<>"{}' ]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
  return `[${address} ${wikiText(label)}]`;
}

function row(track: string, item: DescribedItem): string {
  const title = `'''${wikiText(item.title)}'''${item.duration === '' ? '' : ` (${item.duration})`}`;
  const notes = [item.text === '' ? '' : wikiText(item.text), ...item.links.map((link) => wikiLink(link.label, link.url))].filter((part) => part !== '').join(' ');
  return ['|-', `| data-sort-value="${Math.round(item.first)}" | ${wikiText(item.when)}`, `| ${track}`, `| ${title}`, `| ${notes}`].join('\n');
}

/** The whole timeline as a sortable wikitable. */
export function timelineWikitext(timeline: Timeline, engine: DateEngine): string {
  const description = describeTimeline(timeline, engine);
  const rows: { first: number; order: number; text: string }[] = [];
  let order = 0;
  for (const era of description.eras) rows.push({ first: era.first, order: order++, text: row("''Era''", era) });
  for (const track of description.tracks) {
    for (const item of track.items) rows.push({ first: item.first, order: order++, text: row(wikiText(track.name), item) });
  }
  rows.sort((a, b) => a.first - b.first || a.order - b.order);
  return [
    '{| class="wikitable sortable"',
    `|+ ${wikiText(description.title)}`,
    '! scope="col" | Date',
    '! scope="col" | Track',
    '! scope="col" | What happened',
    '! scope="col" class="unsortable" | Notes',
    ...rows.map((item) => item.text),
    '|}',
  ].join('\n');
}
