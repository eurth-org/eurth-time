/**
 * A timeline, as plain data.
 *
 * A timeline has a title, a calendar (or none, which means Gregorian), eras across the top, and
 * tracks: a nation, a dynasty, the shared world. A track holds spans (a reign, a war, the life
 * of a state) and events (a single date). Nothing here has an id: a thing is named by where it
 * is (see Ref), and every change gives back a new timeline (see ops.ts).
 */
import type { CalendarData } from './engine';
import type { FuzzyDate } from './fuzzy';

/** The version of this format. */
export const TIMELINE_VERSION = 1;

/** What a timeline is held to. Where the Eurth profile has a limit for the same thing, this matches it. */
export const LIMITS = Object.freeze({
  /** Longest timeline title and track name. */
  title: 80,
  name: 80,
  /** Longest event title, span label and era label. */
  label: 200,
  /** Longest text on a card. */
  text: 600,
  /** Most links on a card, and the longest label and address of one. */
  links: 4,
  linkLabel: 80,
  url: 4000,
  tracks: 40,
  eras: 60,
  /** Most spans and most events in one track. */
  spans: 200,
  events: 500,
  /** Most spans and events in the whole timeline. */
  items: 2000,
  /** How many tones a span can have. A tone is a number; the site gives each a colour that differs in lightness. */
  tones: 6,
  /** Longest calendar definition carried inside a timeline, as JSON. */
  calendar: 60_000,
});

/** What a track stands for. It picks the icon beside the track's name. */
export type TrackKind = 'nation' | 'dynasty' | 'world' | 'other';
export const TRACK_KINDS: readonly TrackKind[] = ['nation', 'dynasty', 'world', 'other'];

/** A link on a card: a forum thread, a wiki page. Always https. */
export interface Link {
  label: string;
  url: string;
}

/** A single date on a track. */
export interface TimeEvent {
  title: string;
  date: FuzzyDate;
  text: string;
  links: Link[];
}

/** A stretch of time on a track: a reign, a war, the life of a state. */
export interface Span {
  /** The words on the bar. A span is never told apart by colour alone. */
  label: string;
  from: FuzzyDate;
  /** Null for a span that is still going on. */
  to: FuzzyDate | null;
  text: string;
  links: Link[];
  /** 0 to LIMITS.tones - 1. */
  tone: number;
}

export interface Track {
  name: string;
  kind: TrackKind;
  spans: Span[];
  events: TimeEvent[];
}

/** A named age across the top of the whole timeline. */
export interface Era {
  label: string;
  from: FuzzyDate;
  /** Null for the era that is still going on. */
  to: FuzzyDate | null;
}

export interface Timeline {
  v: typeof TIMELINE_VERSION;
  title: string;
  /** The calendar the dates are in, in @eurth/calendar's shape. Null for the Gregorian calendar. */
  calendar: CalendarData;
  eras: Era[];
  tracks: Track[];
}

/** Where a thing is in a timeline. */
export type Ref = { kind: 'era'; index: number } | { kind: 'span' | 'event'; track: number; index: number };

/** A timeline with nothing in it. */
export const emptyTimeline = (): Timeline => ({ v: TIMELINE_VERSION, title: '', calendar: null, eras: [], tracks: [] });

/** How many spans and events a timeline holds. */
export function countItems(timeline: Timeline): { tracks: number; spans: number; events: number; eras: number } {
  return {
    tracks: timeline.tracks.length,
    spans: timeline.tracks.reduce((sum, track) => sum + track.spans.length, 0),
    events: timeline.tracks.reduce((sum, track) => sum + track.events.length, 0),
    eras: timeline.eras.length,
  };
}

/** The thing a ref points at, or null. */
export function getItem(timeline: Timeline, ref: Ref): Era | Span | TimeEvent | null {
  if (ref.kind === 'era') return timeline.eras[ref.index] ?? null;
  const track = timeline.tracks[ref.track];
  if (track === undefined) return null;
  return (ref.kind === 'span' ? track.spans[ref.index] : track.events[ref.index]) ?? null;
}

/** Whether two refs point at the same thing. */
export function sameRef(a: Ref | null, b: Ref | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind || a.index !== b.index) return false;
  return a.kind === 'era' || b.kind === 'era' ? true : a.track === b.track;
}

/** The name of a thing, whatever it is. */
export const titleOf = (item: Era | Span | TimeEvent): string => ('title' in item ? item.title : item.label);
