/**
 * Where everything goes. layoutTimeline turns a timeline and a view into boxes in pixels:
 * eras across the top, then each track with its spans and events, then the axis. Pure numbers,
 * no DOM: the page draws them, and so does the SVG export.
 *
 * Spans that overlap in time go on rows of their own, decided by their dates alone, so nothing
 * jumps to another row while zooming. Event labels need room that depends on the zoom: a label
 * that would run into the next event is cut short or left out, and the marker always stays.
 * Nothing is told apart by colour alone: every span carries its label, on the bar or beside it,
 * and the text version (describe.ts) has all of it.
 */
import { scaleOf, xOf, type Extent, type View } from './axis';
import type { DateEngine } from './engine';
import { dateRange, isUncertain, type FuzzyDate } from './fuzzy';
import type { Ref, Timeline, TrackKind } from './model';

export interface LayoutOptions {
  /** The height of an era band, a span bar and an event row. */
  eraHeight: number;
  spanHeight: number;
  eventHeight: number;
  /** The space between rows, and above and below a track's rows. */
  rowGap: number;
  trackPad: number;
  /** The height kept for the axis under the tracks. */
  axisHeight: number;
  /** The size of an event's marker, and the space between it and its label. */
  marker: number;
  labelGap: number;
  /** The space between a bar's edge and its label. */
  barPad: number;
  /** Most rows of events in a track. */
  eventRows: number;
  /** The height of the row that heads a group of tracks. */
  groupHeight: number;
  /** The groups that are folded away, by name: their tracks are not drawn, only the group's own row. */
  collapsed: readonly string[];
  /** The width of a text in pixels. The default is a fair guess for the system font at 13 pixels. */
  measure: (text: string, bold: boolean) => number;
}

/** A guess at the width of text in the system font at 13 pixels: good enough to lay out an export without a browser. */
export const guessWidth = (text: string, bold: boolean): number => Array.from(text).length * (bold ? 7.6 : 7);

export const LAYOUT_DEFAULTS: LayoutOptions = Object.freeze({
  eraHeight: 32,
  spanHeight: 36,
  eventHeight: 28,
  rowGap: 6,
  trackPad: 10,
  axisHeight: 28,
  marker: 14,
  labelGap: 6,
  barPad: 10,
  eventRows: 2,
  groupHeight: 44,
  collapsed: [],
  measure: guessWidth,
});

export interface LaidEra {
  ref: Ref;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** The label as it fits: whole, cut short with an ellipsis, or empty. */
  text: string;
  /** Whether the era starts before the view, or ends after it. */
  openStart: boolean;
  openEnd: boolean;
}

export interface LaidSpan {
  ref: Ref;
  x: number;
  y: number;
  w: number;
  h: number;
  row: number;
  tone: number;
  label: string;
  /** The label as it fits. */
  text: string;
  /** Where the label goes: on the bar, after it, or nowhere (the bar is too small and its neighbour too close). */
  place: 'inside' | 'after' | 'hidden';
  openStart: boolean;
  openEnd: boolean;
  /** Whether the span is still going on. */
  ongoing: boolean;
  /** How many pixels at each end are uncertain ("c. 1640", "1650s"): drawn hollow and dashed. 0 when the date is exact. */
  softStart: number;
  softEnd: number;
}

export interface LaidEvent {
  ref: Ref;
  /** The middle of the marker: the middle of the date's stretch, or of as much of it as is in view. */
  x: number;
  y: number;
  h: number;
  row: number;
  label: string;
  /** The label as it fits, or empty. */
  text: string;
  /** The stretch of the axis the date covers: a year-long whisker for "1846", a point for a day. */
  from: number;
  to: number;
  /** Whether the date is marked as loose. */
  uncertain: boolean;
}

export interface LaidTrack {
  index: number;
  name: string;
  kind: TrackKind;
  /** The group the track belongs to, or an empty text. */
  group: string;
  /** Whether the track is folded away with its group: then it has no height and nothing on it is drawn. */
  hidden: boolean;
  y: number;
  height: number;
  spans: LaidSpan[];
  events: LaidEvent[];
}

/** The row that heads a group of tracks: its name, and when the group is folded away, the stretch of time its tracks cover. */
export interface LaidGroup {
  name: string;
  y: number;
  height: number;
  collapsed: boolean;
  /** The tracks in the group, by their place in the timeline. */
  tracks: number[];
  /** How many spans and events the group's tracks hold. */
  items: number;
  /** The stretch its tracks cover, clipped to the view; null when none of it shows. */
  x: number | null;
  w: number;
}

export interface Layout {
  width: number;
  height: number;
  eras: LaidEra[];
  /** The rows that head groups of tracks, top to bottom. */
  groups: LaidGroup[];
  tracks: LaidTrack[];
  /** The top of the axis. */
  axisY: number;
}

/** The first and last day a stretch covers. An open end runs on for ever. */
function stretch(engine: DateEngine, from: FuzzyDate, to: FuzzyDate | null): Extent {
  return { first: dateRange(engine, from).first, last: to === null ? Infinity : dateRange(engine, to).last };
}

/**
 * The stretch of time a timeline covers, from its earliest date to its latest, or null when it
 * holds nothing. Open ends count from where they start.
 */
export function extentOf(timeline: Timeline, engine: DateEngine): Extent | null {
  let first = Infinity;
  let last = -Infinity;
  const take = (date: FuzzyDate | null) => {
    if (date === null) return;
    const range = dateRange(engine, date);
    first = Math.min(first, range.first);
    last = Math.max(last, range.last);
  };
  for (const era of timeline.eras) {
    take(era.from);
    take(era.to);
  }
  for (const track of timeline.tracks) {
    for (const span of track.spans) {
      take(span.from);
      take(span.to);
    }
    for (const event of track.events) take(event.date);
  }
  return first === Infinity ? null : { first, last };
}

/** The tracks that are folded away with their groups, by their place in the timeline. */
export function hiddenTracks(timeline: Timeline, collapsed: readonly string[]): Set<number> {
  const folded = new Set(collapsed);
  return new Set(timeline.tracks.flatMap((track, index) => (track.group !== '' && folded.has(track.group) ? [index] : [])));
}

/** The names of the groups in a timeline, in the order they first appear. */
export const groupNames = (timeline: Timeline): string[] => [...new Set(timeline.tracks.map((track) => track.group).filter((name) => name !== ''))];

/** Puts stretches on rows so that none on a row overlap. Gives the row of each, by its place in the list. */
export function packRows(stretches: readonly Extent[]): number[] {
  const order = stretches.map((_, i) => i).sort((a, b) => stretches[a]!.first - stretches[b]!.first || stretches[b]!.last - stretches[a]!.last || a - b);
  const ends: number[] = [];
  const rows: number[] = [];
  for (const i of order) {
    const item = stretches[i]!;
    let row = ends.findIndex((end) => end < item.first);
    if (row < 0) row = ends.length;
    ends[row] = item.last;
    rows[i] = row;
  }
  return rows;
}

/** A text cut to a width, with an ellipsis. Empty when not even three letters fit. */
export function fitText(text: string, width: number, measure: (text: string) => number): string {
  if (measure(text) <= width) return text;
  const letters = Array.from(text);
  let low = 0;
  let high = letters.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (measure(`${letters.slice(0, middle).join('').trimEnd()}…`) <= width) low = middle;
    else high = middle - 1;
  }
  return low < 3 ? '' : `${letters.slice(0, low).join('').trimEnd()}…`;
}

/** Everything in the view, placed. */
export function layoutTimeline(timeline: Timeline, engine: DateEngine, view: View, options: Partial<LayoutOptions> = {}): Layout {
  const o: LayoutOptions = { ...LAYOUT_DEFAULTS, ...options };
  const scale = scaleOf(view);
  const width = view.width;
  const bold = (text: string) => o.measure(text, true);
  const plain = (text: string) => o.measure(text, false);

  /** A stretch of days as pixels, clipped to the view. Null when none of it shows. */
  const box = (extent: Extent) => {
    const left = xOf(view, extent.first);
    const right = extent.last === Infinity ? Infinity : xOf(view, extent.last + 1);
    if (right <= 0 || left >= width) return null;
    const x = Math.max(0, left);
    return { x, w: Math.max(2, Math.min(width, right) - x), openStart: left < 0, openEnd: right > width, left, right };
  };

  /** How much of an end is uncertain, in pixels. */
  const soft = (date: FuzzyDate | null, w: number): number => {
    if (date === null || !isUncertain(date)) return 0;
    const range = dateRange(engine, date);
    return Math.min(w / 2, Math.max(8, (range.last + 1 - range.first) * scale));
  };

  let y = 0;
  const eraStretches = timeline.eras.map((era) => stretch(engine, era.from, era.to));
  const eraRows = packRows(eraStretches);
  const eras: LaidEra[] = [];
  timeline.eras.forEach((era, index) => {
    const placed = box(eraStretches[index]!);
    if (placed === null) return;
    eras.push({
      ref: { kind: 'era', index },
      x: placed.x,
      y: eraRows[index]! * o.eraHeight,
      w: placed.w,
      h: o.eraHeight,
      label: era.label,
      text: fitText(era.label, placed.w - 2 * o.barPad, bold),
      openStart: placed.openStart,
      openEnd: placed.openEnd,
    });
  });
  y += (eraRows.length === 0 ? 0 : Math.max(...eraRows) + 1) * o.eraHeight;

  const collapsed = new Set(o.collapsed);
  const groups: LaidGroup[] = [];
  const tracks: LaidTrack[] = timeline.tracks.map((track, index) => {
    // A group is a run of neighbouring tracks with the same group name; its row comes before the first of them.
    if (track.group !== '' && timeline.tracks[index - 1]?.group !== track.group) {
      const members: number[] = [];
      for (let i = index; i < timeline.tracks.length && timeline.tracks[i]!.group === track.group; i++) members.push(i);
      let first = Infinity;
      let last = -Infinity;
      let items = 0;
      for (const member of members) {
        const one = timeline.tracks[member]!;
        items += one.spans.length + one.events.length;
        for (const span of one.spans) {
          const covered = stretch(engine, span.from, span.to);
          first = Math.min(first, covered.first);
          last = Math.max(last, covered.last);
        }
        for (const event of one.events) {
          const covered = dateRange(engine, event.date);
          first = Math.min(first, covered.first);
          last = Math.max(last, covered.last);
        }
      }
      const placed = first === Infinity ? null : box({ first, last });
      groups.push({ name: track.group, y, height: o.groupHeight, collapsed: collapsed.has(track.group), tracks: members, items, x: placed?.x ?? null, w: placed?.w ?? 0 });
      y += o.groupHeight;
    }
    if (track.group !== '' && collapsed.has(track.group)) {
      return { index, name: track.name, kind: track.kind, group: track.group, hidden: true, y, height: 0, spans: [], events: [] };
    }
    const top = y;
    const stretches = track.spans.map((span) => stretch(engine, span.from, span.to));
    const rows = packRows(stretches);
    const spanRows = rows.length === 0 ? 0 : Math.max(...rows) + 1;
    const spansTop = top + o.trackPad;

    const spans: LaidSpan[] = [];
    track.spans.forEach((span, i) => {
      const placed = box(stretches[i]!);
      if (placed === null) return;
      spans.push({
        ref: { kind: 'span', track: index, index: i },
        x: placed.x,
        y: spansTop + rows[i]! * (o.spanHeight + o.rowGap),
        w: placed.w,
        h: o.spanHeight,
        row: rows[i]!,
        tone: span.tone,
        label: span.label,
        text: '',
        place: 'hidden',
        openStart: placed.openStart,
        openEnd: placed.openEnd,
        ongoing: span.to === null,
        softStart: placed.openStart ? 0 : soft(span.from, placed.w),
        softEnd: placed.openEnd ? 0 : soft(span.to, placed.w),
      });
    });
    // Labels: on the bar when it fits, else after the bar when the way is clear, else cut short on the bar.
    spans.sort((a, b) => a.row - b.row || a.x - b.x);
    spans.forEach((span, i) => {
      const next = spans[i + 1];
      const free = (next !== undefined && next.row === span.row ? next.x : width) - (span.x + span.w) - 2 * o.labelGap;
      // The label goes on the certain part of the bar: the uncertain ends are drawn hollow.
      const inside = span.w - span.softStart - span.softEnd - 2 * o.barPad;
      const needed = bold(span.label);
      if (needed <= inside) {
        span.place = 'inside';
        span.text = span.label;
      } else if (needed <= free) {
        span.place = 'after';
        span.text = span.label;
      } else {
        const cut = fitText(span.label, inside, bold);
        const beside = cut === '' ? fitText(span.label, free, bold) : '';
        span.place = cut !== '' ? 'inside' : beside !== '' ? 'after' : 'hidden';
        span.text = cut !== '' ? cut : beside;
      }
    });

    // Events: at most a few rows. Each goes on the first row where its label has room; when none has, on the emptiest.
    const eventRows = Math.min(o.eventRows, track.events.length);
    const eventsTop = spansTop + spanRows * (o.spanHeight + o.rowGap);
    const events: LaidEvent[] = [];
    track.events.forEach((event, i) => {
      const range = dateRange(engine, event.date);
      const from = xOf(view, range.first);
      const to = xOf(view, range.last + 1);
      if (to < -o.marker || from > width + o.marker) return;
      // The marker sits in the middle of the date's stretch, or of as much of it as is in view.
      const low = Math.max(from, 0);
      const high = Math.min(to, width);
      const x = to < 0 ? to : from > width ? from : (low + high) / 2;
      events.push({ ref: { kind: 'event', track: index, index: i }, x, y: eventsTop, h: o.eventHeight, row: 0, label: event.title, text: '', from, to, uncertain: isUncertain(event.date) });
    });
    events.sort((a, b) => a.x - b.x || a.ref.index - b.ref.index);
    const labelEnd: number[] = Array.from({ length: eventRows }, () => -Infinity);
    const half = o.marker / 2;
    for (const event of events) {
      let row = labelEnd.findIndex((end) => end + o.labelGap <= event.x - half);
      if (row < 0) row = labelEnd.indexOf(Math.min(...labelEnd));
      event.row = row;
      event.y = eventsTop + row * o.eventHeight;
      labelEnd[row] = event.x + half + o.labelGap + plain(event.label);
    }
    for (let row = 0; row < eventRows; row++) {
      const inRow = events.filter((event) => event.row === row);
      inRow.forEach((event, i) => {
        const next = inRow[i + 1];
        const start = event.x + half + o.labelGap;
        const room = (next === undefined ? Math.max(width, start + plain(event.label)) : next.x - half - o.labelGap) - start;
        event.text = start >= width ? '' : fitText(event.label, room, plain);
      });
    }

    const rowsHeight = spanRows * (o.spanHeight + o.rowGap) + eventRows * o.eventHeight;
    const height = 2 * o.trackPad + Math.max(rowsHeight - (eventRows === 0 && spanRows > 0 ? o.rowGap : 0), o.eventHeight);
    y += height;
    return { index, name: track.name, kind: track.kind, group: track.group, hidden: false, y: top, height, spans, events };
  });

  return { width, height: y + o.axisHeight, eras, groups, tracks, axisY: y };
}
