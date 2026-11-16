/**
 * A timeline on paper: the stretch of time on screen, cut into sheets that follow one another.
 * One sheet shows it as the screen does; more sheets spread the same stretch wider, so that
 * labels the screen had no room for find room on paper. Each sheet is a picture of its own,
 * with the title, the dates it covers and its place in the run.
 *
 * The page prints them one to a page through the browser's own print dialogue, which is also
 * how they become a PDF. Paper is light, so the pictures are drawn in the light theme whatever
 * is on screen.
 */
import type { Extent, View } from './axis';
import type { DateEngine } from './engine';
import type { Timeline } from './model';
import { timelineSvg, type SvgOptions, type SvgTheme } from './svg';

/** How many sheets a timeline can be spread across. */
export const SHEET_CHOICES: readonly number[] = [1, 2, 3, 4, 6, 8, 12];

/** The width of the axis on a sheet, in the picture's own pixels: with the names and the margins, an A4 page on its side. */
export const SHEET_AXIS = 1040;

export interface Sheet {
  svg: string;
  width: number;
  height: number;
  /** What the sheet is, for the picture's alternative text: "History of the Oriental Coast, sheet 2 of 4". */
  label: string;
}

/** The views of the sheets: the stretch cut into equal parts, each starting where the last one ended. */
export function sheetViews(range: Extent, count: number, width: number = SHEET_AXIS): View[] {
  const sheets = Math.min(12, Math.max(1, Math.floor(count) || 1));
  const length = Math.max(1, range.last - range.first) / sheets;
  return Array.from({ length: sheets }, (_, i) => ({ start: range.first + i * length, end: range.first + (i + 1) * length, width }));
}

/**
 * The sheets for a stretch of time.
 * @param range the first and last day number to print: what is on screen
 * @param count how many sheets to spread it across (1 to 12)
 */
export function printSheets(timeline: Timeline, engine: DateEngine, range: Extent, count: number, theme: SvgTheme, options: Omit<SvgOptions, 'theme' | 'note'> = {}): Sheet[] {
  const views = sheetViews(range, count);
  const title = timeline.title === '' ? 'Timeline' : timeline.title;
  return views.map((view, i) => {
    const note = views.length === 1 ? undefined : `sheet ${i + 1} of ${views.length}`;
    const picture = timelineSvg(timeline, engine, view, { ...options, theme, ...(note === undefined ? {} : { note }) });
    return { ...picture, label: note === undefined ? title : `${title}, ${note}` };
  });
}
