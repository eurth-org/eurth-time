/**
 * Moving through a timeline with the keyboard.
 *
 * Left and right step through one track in the order things happened; up and down go to the
 * thing nearest in time on the next track; Home and End go to the first and last of all. Eras
 * are the row above the first track. All of it is worked out here, away from the page, so the
 * page only has to move the focus where it is told.
 */
import { scaleOf, xOf, type Extent, type View } from './axis';
import type { DateEngine } from './engine';
import { dateRange } from './fuzzy';
import { presentDay } from './layout';
import { sameRef, type Ref, type Timeline } from './model';

export interface NavItem {
  ref: Ref;
  /** The row it is on: -1 for the eras, then the tracks from 0. */
  row: number;
  first: number;
  last: number;
}

/**
 * Every era, span and event, in the order things happened. Of two that start together, the
 * upper row first. Tracks folded away (`hidden`, by their place in the list) are left out: the
 * keyboard walks what is on screen.
 */
export function navOrder(timeline: Timeline, engine: DateEngine, hidden: ReadonlySet<number> = new Set()): NavItem[] {
  const items: NavItem[] = [];
  const present = presentDay(timeline, engine) ?? 0;
  const stretch = (ref: Ref, row: number, from: Parameters<typeof dateRange>[1], to: Parameters<typeof dateRange>[1] | null) => {
    const first = dateRange(engine, from).first;
    // Something still going on runs to the timeline's present.
    items.push({ ref, row, first, last: Math.max(first, to === null ? present : dateRange(engine, to).last) });
  };
  timeline.eras.forEach((era, index) => stretch({ kind: 'era', index }, -1, era.from, era.to));
  timeline.tracks.forEach((track, t) => {
    if (hidden.has(t)) return;
    track.spans.forEach((span, index) => stretch({ kind: 'span', track: t, index }, t, span.from, span.to));
    track.events.forEach((event, index) => stretch({ kind: 'event', track: t, index }, t, event.date, event.date));
  });
  const rank = (item: NavItem) => (item.ref.kind === 'event' ? 1 : 0);
  return items.sort((a, b) => a.first - b.first || a.row - b.row || rank(a) - rank(b) || a.ref.index - b.ref.index);
}

const indexOf = (order: readonly NavItem[], ref: Ref | null): number => (ref === null ? -1 : order.findIndex((item) => sameRef(item.ref, ref)));

/** Where a move leads, or null when there is nowhere to go. */
export type Move = 'next' | 'previous' | 'first' | 'last' | 'left' | 'right' | 'up' | 'down';

/**
 * Where a move from `current` leads. From nothing, any move starts at the first thing of all
 * ('last' and 'previous' at the last). At the end of a row, left and right stay put.
 */
export function move(order: readonly NavItem[], current: Ref | null, how: Move): Ref | null {
  if (order.length === 0) return null;
  const at = indexOf(order, current);
  if (how === 'first') return order[0]!.ref;
  if (how === 'last') return order[order.length - 1]!.ref;
  if (at < 0) return how === 'previous' ? order[order.length - 1]!.ref : order[0]!.ref;
  const here = order[at]!;
  if (how === 'next') return (order[at + 1] ?? here).ref;
  if (how === 'previous') return (order[at - 1] ?? here).ref;
  if (how === 'left' || how === 'right') {
    const row = order.filter((item) => item.row === here.row);
    const i = row.indexOf(here);
    return (row[how === 'left' ? i - 1 : i + 1] ?? here).ref;
  }
  // Up and down: the nearest thing in time on the next row that has anything on it.
  const rows = [...new Set(order.map((item) => item.row))].sort((a, b) => a - b);
  const target = rows[rows.indexOf(here.row) + (how === 'up' ? -1 : 1)];
  if (target === undefined) return here.ref;
  const start = here.first;
  const distance = (item: NavItem) => (start >= item.first && start <= item.last ? 0 : Math.min(Math.abs(item.first - start), Math.abs(item.last - start)));
  return order.filter((item) => item.row === target).reduce((best, item) => (distance(item) < distance(best) ? item : best)).ref;
}

/** What a key does on the timeline. */
export type KeyAction =
  | { type: 'move'; how: Move }
  | { type: 'zoom'; factor: number }
  | { type: 'pan'; fraction: number }
  /** Move the thing the keyboard is on earlier (-1) or later (1); `end` moves only a span's end. */
  | { type: 'nudge'; by: -1 | 1; end: boolean }
  | { type: 'fit' }
  | { type: 'open' }
  | { type: 'close' };

/** How much one press of + or - zooms. */
export const ZOOM_STEP = 1.5;

/**
 * The action for a key, or null for a key the timeline leaves alone (Tab above all: focus must
 * be free to leave). `key` is KeyboardEvent.key.
 */
export function keyAction(key: string, modifiers: { shift?: boolean; alt?: boolean } = {}): KeyAction | null {
  if (modifiers.alt) {
    // Alt with an arrow moves the thing itself, as it moves a line in an editor.
    if (key === 'ArrowRight' || key === 'ArrowLeft') return { type: 'nudge', by: key === 'ArrowRight' ? 1 : -1, end: modifiers.shift === true };
    return null;
  }
  switch (key) {
    case 'ArrowRight':
      return modifiers.shift ? { type: 'pan', fraction: 0.2 } : { type: 'move', how: 'right' };
    case 'ArrowLeft':
      return modifiers.shift ? { type: 'pan', fraction: -0.2 } : { type: 'move', how: 'left' };
    case 'ArrowUp':
      return { type: 'move', how: 'up' };
    case 'ArrowDown':
      return { type: 'move', how: 'down' };
    case 'PageDown':
      return { type: 'move', how: 'next' };
    case 'PageUp':
      return { type: 'move', how: 'previous' };
    case 'Home':
      return { type: 'move', how: 'first' };
    case 'End':
      return { type: 'move', how: 'last' };
    case '+':
    case '=':
      return { type: 'zoom', factor: ZOOM_STEP };
    case '-':
    case '_':
      return { type: 'zoom', factor: 1 / ZOOM_STEP };
    case '0':
      return { type: 'fit' };
    case 'Enter':
    case ' ':
      return { type: 'open' };
    case 'Escape':
      return { type: 'close' };
    default:
      return null;
  }
}

/** The keys, for the help text on the page. */
export const KEY_HELP: readonly { keys: string; does: string }[] = Object.freeze([
  { keys: 'Left and Right', does: 'The thing before or after on the same track' },
  { keys: 'Up and Down', does: 'The nearest thing in time on the track above or below' },
  { keys: 'Page Up and Page Down', does: 'The thing before or after on any track' },
  { keys: 'Home and End', does: 'The first or last thing of all' },
  { keys: 'Enter or Space', does: 'Open the card' },
  { keys: 'Escape', does: 'Close the card' },
  { keys: '+ and -', does: 'Zoom in and out' },
  { keys: '0', does: 'Show the whole timeline' },
  { keys: 'Shift with Left or Right', does: 'Slide earlier or later' },
  { keys: 'Alt with Left or Right', does: 'Move the thing itself earlier or later: by a day, a month or a year, as the zoom has it' },
  { keys: 'Alt and Shift with Left or Right', does: 'Move only the end of a span or an era' },
]);

/**
 * A view in which a stretch of time can be seen: the same view when it already can, otherwise
 * the view slid along (never zoomed) until the stretch, or its start if it is too long to fit,
 * is a little inside the edge.
 */
export function revealView(view: View, extent: Extent, margin = 0.08): View {
  const pad = view.width * margin;
  const left = xOf(view, extent.first);
  const right = xOf(view, Math.min(extent.last, extent.first + (view.end - view.start) * (1 - 2 * margin)) + 1);
  let shift = 0;
  if (left < pad) shift = left - pad;
  else if (right > view.width - pad) shift = Math.min(right - (view.width - pad), left - pad);
  if (shift === 0) return view;
  const days = shift / scaleOf(view);
  return { start: view.start + days, end: view.end + days, width: view.width };
}
