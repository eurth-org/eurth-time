/**
 * A timeline on another page: an iframe that shows time.eurth.org/embed/ with the timeline in
 * its link. The suite's security headers allow eurth.org to frame the tools, so this is for the
 * forum and the wiki there; nothing is loaded from anywhere else, and no script is involved.
 */
import { layoutTimeline, type LayoutOptions } from './layout';
import type { DateEngine } from './engine';
import { timelineLink } from './link';
import type { Timeline } from './model';
import { escapeXml } from './svg';

/** The page an embed shows. */
export const EMBED_PATH = 'embed/';

/** The address of a timeline's embed page. `site` is the tool's own address: https://time.eurth.org/. */
export function embedLink(site: string, timeline: Timeline): string {
  return timelineLink(new URL(EMBED_PATH, site).toString(), timeline);
}

/** A fair height for an embed: the timeline's own height at a middling width, and room for its heading and card. */
export function embedHeight(timeline: Timeline, engine: DateEngine, options: Partial<LayoutOptions> = {}): number {
  const layout = layoutTimeline(timeline, engine, { start: 0, end: 1000, width: 800 }, options);
  return Math.min(1200, Math.max(320, Math.round(layout.height + 200)));
}

/**
 * The code to paste: one iframe, as wide as its place allows.
 * @param title what a screen reader calls the frame
 */
export function embedCode(link: string, title: string, height: number): string {
  const name = title.trim() === '' ? 'Timeline' : `${title.trim()}: a timeline`;
  return `<iframe src="${escapeXml(link)}" title="${escapeXml(name)}" width="100%" height="${Math.round(height)}" loading="lazy" style="border:0;max-width:100%"></iframe>`;
}
