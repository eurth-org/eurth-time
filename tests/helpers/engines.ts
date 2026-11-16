import { KHARAN, MERIDIAN, SELUNNAN, TIDEWATCH } from '../../src/content/calendars';
import { engineFor, type DateEngine } from '../../src/tool/engine';

export const gregorian = engineFor(null);
export const selunnan = engineFor(SELUNNAN);
export const tidewatch = engineFor(TIDEWATCH);
export const meridian = engineFor(MERIDIAN);
export const kharan = engineFor(KHARAN);

export const ENGINES: [string, DateEngine][] = [
  ['Gregorian', gregorian],
  ['Selunnan', selunnan],
  ['Tidewatch', tidewatch],
  ['Meridian', meridian],
  ['Kharan', kharan],
];

/** A small seeded random number generator, so a failing test fails the same way twice. */
export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const between = (next: () => number, min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
