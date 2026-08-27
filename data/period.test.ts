import { describe, expect, it } from "vitest";
import { covers, fromPeriod, toPeriod } from "./period";

describe("a period is half-open, first-of-month to first-of-next", () => {
  it("writes a closed range whose upper bound is the month after the end", () => {
    expect(toPeriod({ year: 2026, month: 1 }, { year: 2026, month: 6 })).toBe(
      "[2026-01-01,2026-07-01)",
    );
  });

  it("rolls the upper bound into the next year for a December end", () => {
    expect(toPeriod({ year: 2026, month: 7 }, { year: 2026, month: 12 })).toBe(
      "[2026-07-01,2027-01-01)",
    );
  });

  it("writes an unbounded upper bound for an open tenancy", () => {
    expect(toPeriod({ year: 2026, month: 7 }, null)).toBe("[2026-07-01,)");
  });

  it("round-trips back to the months a person entered", () => {
    const period = toPeriod({ year: 2026, month: 1 }, { year: 2026, month: 6 });
    expect(fromPeriod(period)).toEqual({
      start: { year: 2026, month: 1 },
      end: { year: 2026, month: 6 },
    });
    expect(fromPeriod("[2026-07-01,)")).toEqual({
      start: { year: 2026, month: 7 },
      end: null,
    });
  });

  it("round-trips a December end across the year boundary", () => {
    const period = toPeriod({ year: 2026, month: 7 }, { year: 2026, month: 12 });
    expect(fromPeriod(period).end).toEqual({ year: 2026, month: 12 });
  });

  it("lets a June end and a July start sit adjacent without overlapping", () => {
    const first = toPeriod({ year: 2026, month: 1 }, { year: 2026, month: 6 });
    const second = toPeriod({ year: 2026, month: 7 }, null);
    expect(fromPeriod(first).end).toEqual({ year: 2026, month: 6 });
    expect(fromPeriod(second).start).toEqual({ year: 2026, month: 7 });
  });
});

describe("covers", () => {
  const closed = toPeriod({ year: 2026, month: 1 }, { year: 2026, month: 6 });
  const open = toPeriod({ year: 2026, month: 7 }, null);

  it("includes both ends of a closed period", () => {
    expect(covers(closed, 2026, 1)).toBe(true);
    expect(covers(closed, 2026, 6)).toBe(true);
  });

  it("excludes the months either side", () => {
    expect(covers(closed, 2025, 12)).toBe(false);
    expect(covers(closed, 2026, 7)).toBe(false);
  });

  it("runs forever forward when open-ended", () => {
    expect(covers(open, 2026, 7)).toBe(true);
    expect(covers(open, 2030, 3)).toBe(true);
    expect(covers(open, 2026, 6)).toBe(false);
  });
});
