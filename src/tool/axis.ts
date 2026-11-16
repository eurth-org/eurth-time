/**
 * The year axis: what part of time is on screen, and which ticks and labels to draw there.
 *
 * A view is a first day, a last day and a width in pixels. Zooming changes how many days fit;
 * the ticks follow, from thousands of millions of years down to single days. Each label has an
 * opacity that depends on how much room its kind of tick has, so labels fade in as you zoom in
 * and out as you zoom out, the way place names do on a map. That is Time's signature touch,
 * and it is all in tickOpacity() and labelShown().
 */
import { MAX_YEAR, countsBack, formatYear, inRange, partsOf, yearEnd, yearNumber, yearOf, yearStart } from './dates';
import type { DateEngine } from './engine';
import { dateOfDay, formatDate } from './fuzzy';

/** The stretch of time on screen. Days may be fractions while panning. */
export interface View {
  /** The day number at the left edge. */
  start: number;
  /** The day number at the right edge. */
  end: number;
  /** The width of the axis in pixels. */
  width: number;
}

/** A stretch of days, first and last included. */
export interface Extent {
  first: number;
  last: number;
}

/** Pixels per day. */
export const scaleOf = (view: View): number => view.width / (view.end - view.start);

/** Where a day number is on the axis, in pixels from the left edge. */
export const xOf = (view: View, days: number): number => (days - view.start) * scaleOf(view);

/** The day number at a pixel. */
export const daysAt = (view: View, x: number): number => view.start + x / scaleOf(view);

/** The closest zoom: ten days across the axis. */
export const MIN_VISIBLE_DAYS = 10;

/** All the time there is: from the first day of the first year Time can name to the last day of the last. */
export const allTime = (engine: DateEngine): Extent => ({ first: yearStart(engine, -MAX_YEAR), last: yearEnd(engine, MAX_YEAR) });

/** A view that shows no less than ten days, no more than all of time, and nothing outside it. */
export function clampView(engine: DateEngine, view: View): View {
  const all = allTime(engine);
  const total = all.last + 1 - all.first;
  const width = Math.max(1, view.width);
  const length = Math.min(total, Math.max(MIN_VISIBLE_DAYS, view.end - view.start));
  let start = view.start + (view.end - view.start - length) / 2;
  start = Math.min(all.last + 1 - length, Math.max(all.first, start));
  return { start, end: start + length, width };
}

/**
 * Zooms about a point on the axis, which stays where it is. A factor above 1 zooms in.
 * @param x the pixel to zoom about (default: the middle)
 */
export function zoomView(engine: DateEngine, view: View, factor: number, x: number = view.width / 2): View {
  if (!(factor > 0) || !Number.isFinite(factor)) return view;
  const all = allTime(engine);
  const length = Math.min(all.last + 1 - all.first, Math.max(MIN_VISIBLE_DAYS, (view.end - view.start) / factor));
  const anchor = daysAt(view, x);
  const start = anchor - (x / view.width) * length;
  return clampView(engine, { start, end: start + length, width: view.width });
}

/** Slides the view by a number of pixels: a positive number moves towards later times. */
export function panView(engine: DateEngine, view: View, pixels: number): View {
  const shift = pixels / scaleOf(view);
  return clampView(engine, { start: view.start + shift, end: view.end + shift, width: view.width });
}

/** The same stretch of time at another width. */
export const resizeView = (view: View, width: number): View => ({ ...view, width: Math.max(1, width) });

/** A view that shows a stretch of time whole, with a little air on both sides. */
export function fitView(engine: DateEngine, extent: Extent, width: number, padding = 0.05): View {
  const length = Math.max(MIN_VISIBLE_DAYS, extent.last + 1 - extent.first);
  const middle = (extent.first + extent.last + 1) / 2;
  const half = length * (0.5 + padding);
  return clampView(engine, { start: middle - half, end: middle + half, width });
}

/** The view a new, empty timeline opens on: a century and a half around year 1900 of whatever calendar it is. */
export const defaultView = (engine: DateEngine, width: number): View =>
  fitView(engine, { first: yearStart(engine, 1850), last: yearEnd(engine, 2000) }, width, 0);

/** What kind of tick: the start of a year, of a month (or a block outside the months), or of a day. */
export type TickUnit = 'year' | 'part' | 'day';

export interface Tick {
  /** The day number the tick stands on. */
  days: number;
  /** Its place on the axis, in pixels. */
  x: number;
  unit: TickUnit;
  /** The label, or an empty string for a tick that is only a line. */
  label: string;
  /** 0 to 1: how strongly to draw the label and its line. This is what fades as you zoom. */
  opacity: number;
}

export interface TickOptions {
  /** A year label starts to show when its ticks are this many pixels apart, and is fully there at `yearFull`. */
  yearFrom?: number;
  yearFull?: number;
  /** The same for month labels. */
  partFrom?: number;
  partFull?: number;
  /** The same for day numbers. */
  dayFrom?: number;
  dayFull?: number;
}

const DEFAULTS: Required<TickOptions> = { yearFrom: 56, yearFull: 104, partFrom: 34, partFull: 60, dayFrom: 15, dayFull: 28 };

/**
 * How visible a label is when its ticks are `spacing` pixels apart: nothing below `from`,
 * everything above `full`, and a smooth rise in between.
 */
export function tickOpacity(spacing: number, from: number, full: number): number {
  if (!(spacing > from)) return 0;
  if (spacing >= full) return 1;
  const t = (spacing - from) / (full - from);
  return t * t * (3 - 2 * t);
}

/**
 * A label is drawn once it is at least half-way in. At rest a label is fully there or not there
 * at all, so it always meets the contrast the suite asks of text; the fading happens in the
 * moment it crosses this line, as a short transition on the page. A tick's line has no such
 * need and takes its opacity as it comes.
 */
export const LABEL_SHOWN = 0.5;

/** Whether a tick's label should be drawn. */
export const labelShown = (tick: Tick): boolean => tick.label !== '' && tick.opacity >= LABEL_SHOWN;

/**
 * The steps between year ticks: 1, 5, 10, 50, 100 and so on. Each step divides the next, so a
 * tick that is there at one zoom is still there at every closer one: labels are only ever
 * added on the way in.
 */
export const YEAR_STEPS: readonly number[] = (() => {
  const steps: number[] = [];
  for (let step = 1; step <= 5e10; step *= 10) steps.push(step, step * 5);
  return steps;
})();

/** The smallest step whose ticks are at least `from` pixels apart. */
export function yearStep(pixelsPerYear: number, from: number = DEFAULTS.yearFrom): number {
  return YEAR_STEPS.find((step) => step * pixelsPerYear >= from) ?? YEAR_STEPS[YEAR_STEPS.length - 1]!;
}

/**
 * The ticks to draw for a view, earliest first. Years always; months once they have room; days
 * once they do. Where a year starts, the year's label stands; where a month starts, the month's.
 */
export function ticks(engine: DateEngine, view: View, options: TickOptions = {}): Tick[] {
  const o = { ...DEFAULTS, ...options };
  const scale = scaleOf(view);
  const perYear = engine.meanYear * scale;
  const step = yearStep(perYear, o.yearFrom);
  const firstYear = yearOf(engine, view.start);
  const lastYear = yearOf(engine, view.end);
  const back = countsBack(engine);
  const showEra = back && firstYear < 1;
  const found = new Map<number, Tick>();

  const add = (days: number, unit: TickUnit, label: string, opacity: number) => {
    if (days < view.start || days > view.end || found.has(days)) return;
    found.set(days, { days, x: xOf(view, days), unit, label: opacity > 0.02 ? label : '', opacity: Math.round(opacity * 1000) / 1000 });
  };

  /** A year tick is as visible as the coarsest step it belongs to. */
  const yearTick = (year: number, pivot = false) => {
    const n = yearNumber(engine, year);
    let opacity = pivot ? 1 : 0;
    for (const s of YEAR_STEPS) {
      if (opacity >= 1 || n % s !== 0) break;
      if (s >= step) opacity = tickOpacity(s * perYear, o.yearFrom, o.yearFull);
    }
    add(yearStart(engine, year), 'year', formatYear(engine, year, { compact: true, era: showEra }), opacity);
  };

  if (back) {
    // Years from 1 on count up; the years before count up the other way, and both sides want round numbers.
    if (step > 1 && firstYear <= 1 && lastYear >= 1) yearTick(1, true);
    for (let n = Math.max(step, Math.ceil(Math.max(firstYear, 1) / step) * step); n <= lastYear; n += step) yearTick(n);
    const nearest = 1 - Math.min(lastYear, 0);
    for (let n = Math.max(step, Math.ceil(nearest / step) * step); n <= 1 - firstYear; n += step) yearTick(1 - n);
  } else {
    for (let n = Math.ceil(firstYear / step) * step; n <= lastYear; n += step) yearTick(n);
  }

  // Months and days, where the engine counts them and there is room.
  const perPart = perYear / engine.months.length;
  const partOpacity = tickOpacity(perPart, o.partFrom, o.partFull);
  const dayOpacity = tickOpacity(scale, o.dayFrom, o.dayFull);
  if (partOpacity > 0) {
    for (let year = firstYear; year <= lastYear; year++) {
      if (!inRange(engine, year)) continue;
      for (const part of partsOf(engine, year)) {
        if (part.days < 1 || part.start + part.days < view.start || part.start > view.end) continue;
        const names = part.kind === 'month' ? engine.months[part.index - 1]! : { name: part.name, short: part.name };
        // A day or two outside the months has no room for its name until the days themselves show.
        const roomy = part.days * scale >= o.partFrom;
        add(part.start, 'part', roomy ? (dayOpacity > 0.5 ? names.name : names.short) : '', roomy ? partOpacity : partOpacity * 0.5);
        if (dayOpacity > 0) {
          for (let day = 2; day <= part.days; day++) add(part.start + day - 1, 'day', String(day), dayOpacity);
        }
      }
    }
  }
  return [...found.values()].sort((a, b) => a.days - b.days);
}

/** How finely the view should be spoken of: by the day, the month or the year. */
export function viewPrecision(engine: DateEngine, view: View): 'day' | 'month' | 'year' {
  const days = view.end - view.start;
  if (days <= engine.meanYear / 4) return 'day';
  return days <= engine.meanYear * 3 ? 'month' : 'year';
}

/** The stretch of time on screen, in words: "1600 – 2030 CE", "Harvestmoon 1022 FS – Thawmoon 1023 FS". */
export function viewLabel(engine: DateEngine, view: View): string {
  const precision = viewPrecision(engine, view);
  const from = dateOfDay(engine, view.start, precision);
  const to = dateOfDay(engine, Math.max(view.start, view.end - 1), precision);
  if (precision === 'year') {
    if (from.year === to.year) return formatYear(engine, from.year);
    const sameSide = !countsBack(engine) || from.year >= 1 === to.year >= 1;
    return `${formatYear(engine, from.year, { era: !sameSide })} – ${formatYear(engine, to.year)}`;
  }
  const a = formatDate(engine, from);
  const b = formatDate(engine, to);
  return a === b ? a : `${a} – ${b}`;
}
