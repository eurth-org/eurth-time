/**
 * Changing a timeline. Nothing here changes what it is given: every function gives back a new
 * timeline, cleaned (see normalize.ts), so undo is nothing more than keeping the old ones
 * (see history.ts). A change that cannot be made gives back the timeline it was given.
 */
import type { CalendarData } from './engine';
import { encodeDate, type FuzzyDate } from './fuzzy';
import { LIMITS, type Era, type Ref, type Span, type TimeEvent, type Timeline, type Track, type TrackKind } from './model';
import { normalizeTimeline, type Issue } from './normalize';

const clean = (draft: unknown): Timeline => normalizeTimeline(draft).timeline;

const withTracks = (timeline: Timeline, tracks: Track[]): Timeline => ({ ...timeline, tracks });

const replaceAt = <T>(list: readonly T[], index: number, item: T): T[] => list.map((old, i) => (i === index ? item : old));

/** What a new span needs; the rest has defaults. */
export type NewSpan = { label: string; from: FuzzyDate; to?: FuzzyDate | null; text?: string; links?: Span['links']; tone?: number; picture?: Span['picture'] };
export type NewEvent = { title: string; date: FuzzyDate; text?: string; links?: TimeEvent['links']; picture?: TimeEvent['picture'] };
export type NewEra = { label: string; from: FuzzyDate; to?: FuzzyDate | null };

export function setTitle(timeline: Timeline, title: string): Timeline {
  return clean({ ...timeline, title });
}

/**
 * Puts the timeline in another calendar. The dates keep their numbers (year 1022, month 9,
 * day 17) and are made to fit: a month the new calendar does not have falls back to the year.
 * `issues` says what moved.
 */
export function setCalendar(timeline: Timeline, calendar: CalendarData): { timeline: Timeline; issues: Issue[] } {
  return normalizeTimeline({ ...timeline, calendar });
}

/**
 * Sets, or with null takes away, the second calendar the axis is read in. It is kept only when
 * it differs from the timeline's own and both are tied to Earth; otherwise the timeline comes
 * back with none.
 */
export function setAlso(timeline: Timeline, also: CalendarData): Timeline {
  return clean({ ...timeline, also });
}

/**
 * Sets the world's today, the date things still going on are drawn to; with null, back to the
 * latest date on the timeline. A date that can't be read changes nothing.
 */
export function setPresent(timeline: Timeline, present: FuzzyDate | null): Timeline {
  const next = clean({ ...timeline, present });
  return present !== null && next.present === null ? timeline : next;
}

/** Adds a track at the end. */
export function addTrack(timeline: Timeline, name = '', kind: TrackKind = 'nation'): Timeline {
  if (timeline.tracks.length >= LIMITS.tracks) return timeline;
  return clean(withTracks(timeline, [...timeline.tracks, { name, kind, group: '', spans: [], events: [] }]));
}

/** Adds whole tracks at the end: reigns from a dynasty, or someone else's nation. */
export function appendTracks(timeline: Timeline, tracks: readonly Track[]): Timeline {
  return clean(withTracks(timeline, [...timeline.tracks, ...tracks]));
}

export function updateTrack(timeline: Timeline, index: number, patch: { name?: string; kind?: TrackKind; group?: string }): Timeline {
  const track = timeline.tracks[index];
  if (track === undefined) return timeline;
  return clean(withTracks(timeline, replaceAt(timeline.tracks, index, { ...track, ...patch })));
}

/** Moves a track up or down the list. */
export function moveTrack(timeline: Timeline, from: number, to: number): Timeline {
  const track = timeline.tracks[from];
  if (track === undefined || to < 0 || to >= timeline.tracks.length || to === from) return timeline;
  const tracks = timeline.tracks.filter((_, i) => i !== from);
  tracks.splice(to, 0, track);
  return withTracks(timeline, tracks);
}

/** What a merge brought in. */
export interface Added {
  tracks: number;
  spans: number;
  events: number;
  eras: number;
}

/**
 * Brings another timeline's eras and tracks into this one: an imported sheet, or someone else's
 * nation. A track whose name is already here (whatever its capitals) gains the newcomer's spans
 * and events; any other is added whole, at the end. A thing that is already here, by its name
 * and its dates, is not added twice. Both timelines must be in the same calendar: see convert.ts
 * for when they are not. `added` counts what came in; limits may leave some of it out.
 */
export function mergeTimeline(base: Timeline, incoming: Timeline): { timeline: Timeline; added: Added } {
  const stamp = (name: string, from: FuzzyDate, to: FuzzyDate | null) => `${name.toLowerCase()}|${encodeDate(from)}|${to === null ? '' : encodeDate(to)}`;
  const eraKeys = new Set(base.eras.map((era) => stamp(era.label, era.from, era.to)));
  const eras = [...base.eras, ...incoming.eras.filter((era) => !eraKeys.has(stamp(era.label, era.from, era.to)))];
  const tracks: Track[] = base.tracks.map((track) => ({ ...track }));
  for (const track of incoming.tracks) {
    const home = tracks.find((one) => one.name.toLowerCase() === track.name.toLowerCase());
    if (home === undefined) {
      tracks.push(track);
      continue;
    }
    const spanKeys = new Set(home.spans.map((span) => stamp(span.label, span.from, span.to)));
    const eventKeys = new Set(home.events.map((event) => stamp(event.title, event.date, null)));
    home.spans = [...home.spans, ...track.spans.filter((span) => !spanKeys.has(stamp(span.label, span.from, span.to)))];
    home.events = [...home.events, ...track.events.filter((event) => !eventKeys.has(stamp(event.title, event.date, null)))];
  }
  const timeline = clean({ ...base, eras, tracks });
  const count = (of: Timeline) => ({ tracks: of.tracks.length, spans: of.tracks.reduce((sum, track) => sum + track.spans.length, 0), events: of.tracks.reduce((sum, track) => sum + track.events.length, 0), eras: of.eras.length });
  const before = count(base);
  const after = count(timeline);
  return { timeline, added: { tracks: after.tracks - before.tracks, spans: after.spans - before.spans, events: after.events - before.events, eras: after.eras - before.eras } };
}

/** "2 tracks, 3 spans and 12 events", for what a merge brought in; "nothing new" when it brought nothing. */
export function addedLine(added: Added): string {
  const parts = (
    [
      [added.tracks, 'track'],
      [added.spans, 'span'],
      [added.events, 'event'],
      [added.eras, 'era'],
    ] as const
  )
    .filter(([n]) => n > 0)
    .map(([n, word]) => `${n} ${word}${n === 1 ? '' : 's'}`);
  if (parts.length === 0) return 'nothing new';
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]!}`;
}

/** Removes a track and everything on it. */
export function removeTrack(timeline: Timeline, index: number): Timeline {
  if (timeline.tracks[index] === undefined) return timeline;
  return withTracks(timeline, timeline.tracks.filter((_, i) => i !== index));
}

/** Adds a span to a track. `ref` points at it, or is null when it could not be added. */
export function addSpan(timeline: Timeline, track: number, span: NewSpan): { timeline: Timeline; ref: Ref | null } {
  const target = timeline.tracks[track];
  if (target === undefined) return { timeline, ref: null };
  const next = clean(withTracks(timeline, replaceAt(timeline.tracks, track, { ...target, spans: [...target.spans, { to: null, ...span } as Span] })));
  const added = next.tracks[track]!.spans.length === target.spans.length + 1;
  return added ? { timeline: next, ref: { kind: 'span', track, index: target.spans.length } } : { timeline, ref: null };
}

/** Adds an event to a track. `ref` points at it, or is null when it could not be added. */
export function addEvent(timeline: Timeline, track: number, event: NewEvent): { timeline: Timeline; ref: Ref | null } {
  const target = timeline.tracks[track];
  if (target === undefined) return { timeline, ref: null };
  const next = clean(withTracks(timeline, replaceAt(timeline.tracks, track, { ...target, events: [...target.events, event as TimeEvent] })));
  const added = next.tracks[track]!.events.length === target.events.length + 1;
  return added ? { timeline: next, ref: { kind: 'event', track, index: target.events.length } } : { timeline, ref: null };
}

/** Adds an era. `ref` points at it, or is null when it could not be added. */
export function addEra(timeline: Timeline, era: NewEra): { timeline: Timeline; ref: Ref | null } {
  if (timeline.eras.length >= LIMITS.eras) return { timeline, ref: null };
  const next = clean({ ...timeline, eras: [...timeline.eras, { to: null, ...era }] });
  return next.eras.length === timeline.eras.length + 1 ? { timeline: next, ref: { kind: 'era', index: timeline.eras.length } } : { timeline, ref: null };
}

/**
 * Changes an era, a span or an event: give only the fields that change. A change that would
 * leave it without a readable date is not made.
 */
export function updateItem(timeline: Timeline, ref: Ref, patch: Partial<Era> | Partial<Span> | Partial<TimeEvent>): Timeline {
  let draft: Timeline;
  if (ref.kind === 'era') {
    const era = timeline.eras[ref.index];
    if (era === undefined) return timeline;
    draft = { ...timeline, eras: replaceAt(timeline.eras, ref.index, { ...era, ...patch } as Era) };
  } else {
    const track = timeline.tracks[ref.track];
    const list: readonly (Span | TimeEvent)[] | undefined = ref.kind === 'span' ? track?.spans : track?.events;
    const item = list?.[ref.index];
    if (track === undefined || list === undefined || item === undefined) return timeline;
    const changed = replaceAt(list, ref.index, { ...item, ...patch } as Span | TimeEvent);
    draft = withTracks(timeline, replaceAt(timeline.tracks, ref.track, { ...track, [ref.kind === 'span' ? 'spans' : 'events']: changed } as Track));
  }
  const next = clean(draft);
  const same =
    next.eras.length === timeline.eras.length && next.tracks.every((track, i) => track.spans.length === timeline.tracks[i]!.spans.length && track.events.length === timeline.tracks[i]!.events.length);
  return same ? next : timeline;
}

/** Removes an era, a span or an event. */
export function removeItem(timeline: Timeline, ref: Ref): Timeline {
  if (ref.kind === 'era') {
    return timeline.eras[ref.index] === undefined ? timeline : { ...timeline, eras: timeline.eras.filter((_, i) => i !== ref.index) };
  }
  const track = timeline.tracks[ref.track];
  const key = ref.kind === 'span' ? 'spans' : 'events';
  if (track === undefined || track[key][ref.index] === undefined) return timeline;
  const list = (track[key] as (Span | TimeEvent)[]).filter((_, i) => i !== ref.index);
  return withTracks(timeline, replaceAt(timeline.tracks, ref.track, { ...track, [key]: list } as Track));
}

/** Moves a span or an event to another track. `ref` points at it in its new place. */
export function moveItem(timeline: Timeline, ref: Ref, toTrack: number): { timeline: Timeline; ref: Ref } {
  if (ref.kind === 'era' || ref.track === toTrack) return { timeline, ref };
  const from = timeline.tracks[ref.track];
  const to = timeline.tracks[toTrack];
  const key = ref.kind === 'span' ? 'spans' : 'events';
  const item = from?.[key][ref.index];
  if (from === undefined || to === undefined || item === undefined) return { timeline, ref };
  if (to[key].length >= (ref.kind === 'span' ? LIMITS.spans : LIMITS.events)) return { timeline, ref };
  const tracks = timeline.tracks.map((track, i) => {
    if (i === ref.track) return { ...track, [key]: (track[key] as (Span | TimeEvent)[]).filter((_, j) => j !== ref.index) } as Track;
    if (i === toTrack) return { ...track, [key]: [...track[key], item] } as Track;
    return track;
  });
  return { timeline: withTracks(timeline, tracks), ref: { kind: ref.kind, track: toTrack, index: to[key].length } };
}
