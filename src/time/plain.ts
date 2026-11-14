/**
 * A plain date engine of Time's own, standing in until @eurth/calendar 1.0.0 is released
 * (roadmap.md, step 4h). It reads the same calendar definition: months, days outside the
 * months, and leap rules. It counts days exactly as the package does: day 0 is day 1 of year 1,
 * and the year before year 1 is year 0. Weeks, moons and holidays are none of a timeline's
 * business and are left alone.
 */
import type { DateEngine, YearPart } from './engine';

/** The part of a calendar definition a timeline runs on. */
export interface CalendarSpec {
  name: string;
  era: string;
  eraBefore: string;
  months: { name: string; short?: string; days: number }[];
  intercalary: { name: string; after: number; days: number }[];
  leap: { every: number; except: number[]; days: number; to: { month: number } | { intercalary: number } }[];
}

/** The same limits @eurth/calendar holds a definition to. */
const LIMITS = {
  name: 80,
  short: 12,
  era: 20,
  eraBefore: 40,
  months: 100,
  monthDays: 1000,
  intercalary: 20,
  intercalaryDays: 1000,
  leapRules: 8,
  leapEvery: 100_000,
  leapExceptions: 3,
  leapCycle: 10_000_000,
  leapDays: 1000,
  maxYear: 10_000_000,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown, max: number): string =>
  typeof value === 'string'
    ? Array.from(value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, max).join('')
    : '';

const whole = (value: unknown, min: number, max: number): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;

const list = (value: unknown, max: number): unknown[] => (Array.isArray(value) ? value.slice(0, max) : []);

/**
 * The usable calendar in a value from anywhere, or null when there is none (no months).
 * Anything out of bounds is dropped or clamped; nothing throws.
 */
export function cleanSpec(input: unknown): CalendarSpec | null {
  if (!isRecord(input)) return null;
  const months: CalendarSpec['months'] = [];
  for (const item of list(input.months, LIMITS.months)) {
    if (!isRecord(item)) continue;
    const name = text(item.name, LIMITS.name);
    const days = whole(item.days, 1, LIMITS.monthDays);
    if (name === '' || days === null) continue;
    const short = text(item.short, LIMITS.short);
    months.push(short === '' ? { name, days } : { name, short, days });
  }
  if (months.length === 0) return null;

  const intercalary: CalendarSpec['intercalary'] = [];
  for (const item of list(input.intercalary, LIMITS.intercalary)) {
    if (!isRecord(item)) continue;
    const name = text(item.name, LIMITS.name);
    const days = whole(item.days, 0, LIMITS.intercalaryDays);
    if (name === '' || days === null) continue;
    intercalary.push({ name, after: whole(item.after, 0, months.length) ?? months.length, days });
  }

  const leap: CalendarSpec['leap'] = [];
  for (const item of list(input.leap, LIMITS.leapRules)) {
    if (!isRecord(item) || !isRecord(item.to)) continue;
    const every = whole(item.every, 1, LIMITS.leapEvery);
    const days = whole(item.days, 1, LIMITS.leapDays);
    if (every === null || days === null) continue;
    const month = whole(item.to.month, 1, months.length);
    const block = whole(item.to.intercalary, 1, intercalary.length);
    if (month === null && block === null) continue;
    const except: number[] = [];
    for (const value of list(item.except, LIMITS.leapExceptions)) {
      const number = whole(value, 1, LIMITS.leapCycle);
      if (number === null) break;
      except.push(number);
    }
    leap.push({ every, except, days, to: month !== null ? { month } : { intercalary: block! } });
  }

  return {
    name: text(input.name, LIMITS.name),
    era: text(input.era, LIMITS.era),
    eraBefore: text(input.eraBefore, LIMITS.eraBefore),
    months,
    intercalary,
    leap,
  };
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;
const divides = (year: number, by: number): boolean => ((year % by) + by) % by === 0;

interface Slot {
  kind: 'month' | 'intercalary';
  index: number;
  name: string;
  days: number;
}

interface Rule {
  /** Every, then every and the first exception together, and so on: each undoes the one before. */
  chain: number[];
  days: number;
  slot: number;
}

/** The first three letters of a name, for where the name is too long. */
export const shortName = (name: string, short?: string): string =>
  short !== undefined && short !== '' ? short : Array.from(name).slice(0, 3).join('');

/** An engine for a calendar spec. The spec must be clean: see cleanSpec. */
export function plainEngine(spec: CalendarSpec): DateEngine {
  const slots: Slot[] = [];
  const blockSlot: number[] = [];
  const monthSlot: number[] = [];
  const pushBlocks = (after: number) => {
    spec.intercalary.forEach((block, i) => {
      if (block.after !== after) return;
      blockSlot[i] = slots.length;
      slots.push({ kind: 'intercalary', index: i + 1, name: block.name, days: block.days });
    });
  };
  pushBlocks(0);
  spec.months.forEach((month, i) => {
    monthSlot[i] = slots.length;
    slots.push({ kind: 'month', index: i + 1, name: month.name, days: month.days });
    pushBlocks(i + 1);
  });

  const rules: Rule[] = spec.leap.map((rule) => {
    const chain = [rule.every];
    for (const exception of rule.except) {
      const next = lcm(chain[chain.length - 1]!, exception);
      if (next > LIMITS.leapCycle) break;
      chain.push(next);
    }
    const slot = 'month' in rule.to ? monthSlot[rule.to.month - 1]! : blockSlot[rule.to.intercalary - 1]!;
    return { chain, days: rule.days, slot };
  });

  const base = slots.reduce((sum, slot) => sum + slot.days, 0);

  /** Leap years of a rule in the years 1 to n; minus those in n + 1 to 0 when n is below 0. */
  const leapsUpTo = (rule: Rule, n: number): number =>
    rule.chain.reduce((sum, by, k) => sum + (k % 2 === 0 ? 1 : -1) * Math.floor(n / by), 0);

  const matches = (rule: Rule, year: number): boolean => {
    let leap = false;
    for (let k = rule.chain.length - 1; k >= 0; k--) leap = divides(year, rule.chain[k]!) && !leap;
    return leap;
  };

  const meanYear = rules.reduce(
    (sum, rule) => sum + rule.days * rule.chain.reduce((part, by, k) => part + (k % 2 === 0 ? 1 : -1) / by, 0),
    base,
  );

  const yearStart = (year: number): number =>
    rules.reduce((sum, rule) => sum + rule.days * leapsUpTo(rule, year - 1), (year - 1) * base);

  const minYear = -LIMITS.maxYear;
  const maxYear = LIMITS.maxYear;

  const longest = (slot: number): number =>
    slots[slot]!.days + rules.reduce((sum, rule) => sum + (rule.slot === slot ? rule.days : 0), 0);

  return {
    name: spec.name,
    era: spec.era,
    eraBefore: spec.eraBefore,
    months: spec.months.map((month) => ({ name: month.name, short: shortName(month.name, month.short) })),
    intercalary: spec.intercalary.map((block, i) => ({ name: block.name, single: longest(blockSlot[i]!) <= 1 })),
    minYear,
    maxYear,
    meanYear,
    yearStart,
    yearOf(days: number): number {
      let year = Math.min(maxYear, Math.max(minYear, Math.floor(days / meanYear) + 1));
      while (year > minYear && yearStart(year) > days) year--;
      while (year < maxYear && yearStart(year + 1) <= days) year++;
      return year;
    },
    parts(year: number): YearPart[] {
      let start = yearStart(year);
      return slots.map((slot, i) => {
        const days = rules.reduce((sum, rule) => sum + (rule.slot === i && matches(rule, year) ? rule.days : 0), slot.days);
        const part: YearPart = { kind: slot.kind, index: slot.index, name: slot.name, days, start };
        start += days;
        return part;
      });
    },
  };
}

/** The Gregorian calendar, run backwards and forwards for ever: Time's calendar when it is given none. */
export const GREGORIAN_SPEC: CalendarSpec = {
  name: 'Gregorian calendar',
  era: 'CE',
  eraBefore: 'BCE',
  months: [
    ['January', 31],
    ['February', 28],
    ['March', 31],
    ['April', 30],
    ['May', 31],
    ['June', 30],
    ['July', 31],
    ['August', 31],
    ['September', 30],
    ['October', 31],
    ['November', 30],
    ['December', 31],
  ].map(([name, days]) => ({ name: name as string, days: days as number })),
  intercalary: [],
  leap: [{ every: 4, except: [100, 400], days: 1, to: { month: 2 } }],
};
