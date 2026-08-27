/**
 * The product speaks in months; Postgres needs dates to check overlap. One
 * convention, stated once, so every caller agrees on where a month ends.
 *
 * A period is a half-open `[)` range: the first day of the start month, up to
 * the first day of the month *after* the end month. A tenancy ending in June
 * and one starting in July therefore touch without overlapping. An open-ended
 * tenancy stores an unbounded upper bound.
 */

export type MonthRef = { year: number; month: number };

function firstOf({ year, month }: MonthRef): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function firstOfNext({ year, month }: MonthRef): string {
  return month === 12 ? `${year + 1}-01-01` : firstOf({ year, month: month + 1 });
}

export function toPeriod(start: MonthRef, end: MonthRef | null): string {
  return `[${firstOf(start)},${end ? firstOfNext(end) : ""})`;
}

/** Reads a stored range back into the months a person entered. */
export function fromPeriod(period: string): { start: MonthRef; end: MonthRef | null } {
  const match = /^\[(\d{4})-(\d{2})-\d{2},(?:(\d{4})-(\d{2})-\d{2})?\)$/.exec(period);
  if (!match) throw new Error(`Unrecognised period: ${period}`);

  const start = { year: Number(match[1]), month: Number(match[2]) };
  if (!match[3]) return { start, end: null };

  /* The stored upper bound is exclusive, so the last covered month is the one before it. */
  const boundYear = Number(match[3]);
  const boundMonth = Number(match[4]);
  const end =
    boundMonth === 1 ? { year: boundYear - 1, month: 12 } : { year: boundYear, month: boundMonth - 1 };
  return { start, end };
}

/** Whether a tenancy covers a given month, for deciding which units a month shows. */
export function covers(period: string, year: number, month: number): boolean {
  const { start, end } = fromPeriod(period);
  const point = year * 12 + month;
  if (point < start.year * 12 + start.month) return false;
  if (end && point > end.year * 12 + end.month) return false;
  return true;
}
