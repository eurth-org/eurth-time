/**
 * Undo and redo. A timeline is never changed in place, so its history is a list of timelines.
 * Kept in memory for the visit only: nothing is stored.
 */

export interface History<T> {
  past: readonly T[];
  present: T;
  future: readonly T[];
}

/** How many steps back are kept. */
export const HISTORY_DEPTH = 100;

export const startHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });

/** Records a change. Recording the very same value again changes nothing. */
export function record<T>(history: History<T>, next: T): History<T> {
  if (next === history.present) return history;
  return { past: [...history.past, history.present].slice(-HISTORY_DEPTH), present: next, future: [] };
}

export const canUndo = <T>(history: History<T>): boolean => history.past.length > 0;
export const canRedo = <T>(history: History<T>): boolean => history.future.length > 0;

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redo<T>(history: History<T>): History<T> {
  const next = history.future[0];
  if (next === undefined) return history;
  return { past: [...history.past, history.present], present: next, future: history.future.slice(1) };
}
