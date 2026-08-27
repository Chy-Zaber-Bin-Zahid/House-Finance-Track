import { describe, expect, it } from "vitest";
import {
  billColumnTotal,
  chartBars,
  monthBillTotal,
  monthRentTotal,
  showsTick,
  unitMonthlyRent,
  unitYearTotal,
  upcomingCount,
  yearBillTotal,
  yearRentTotal,
} from "@/lib/derive";
import { createInitialState } from "@/lib/seed";

/**
 * Characterization of the figures the sheet shows today. These values are the
 * owner's real 2026 sheet; the rebuild must still produce them.
 */
const state = createInitialState();

describe("year totals", () => {
  it("matches the rent, bills, and net the sheet shows today", () => {
    expect(yearRentTotal(state)).toBe(115_100);
    expect(yearBillTotal(state)).toBe(34_110);
    expect(yearRentTotal(state) - yearBillTotal(state)).toBe(80_990);
  });

  it("splits the bill total across its three columns", () => {
    expect(billColumnTotal(state, 0)).toBe(1_887);
    expect(billColumnTotal(state, 1)).toBe(12_960);
    expect(billColumnTotal(state, 2)).toBe(19_263);
    const columns = [0, 1, 2].reduce((total, i) => total + billColumnTotal(state, i), 0);
    expect(columns).toBe(yearBillTotal(state));
  });
});

describe("month totals", () => {
  it("computes August from its own entries", () => {
    expect(monthBillTotal(state, 7)).toBe(6_361);
    expect(monthRentTotal(state, 7)).toBe(16_500);
  });

  it("reports no rent for a month before any tenancy collected", () => {
    expect(monthRentTotal(state, 0)).toBe(0);
    expect(monthBillTotal(state, 0)).toBe(1_080);
  });

  it("sums every month back to the year", () => {
    const months = Array.from({ length: 12 }, (_, i) => monthRentTotal(state, i));
    expect(months.reduce((a, b) => a + b, 0)).toBe(yearRentTotal(state));
  });
});

describe("per-unit figures", () => {
  it("totals what each unit collected across the year", () => {
    expect(state.units.map(unitYearTotal)).toEqual([34_500, 14_600, 66_000]);
  });

  it("reports the rent a unit charges", () => {
    expect(state.units.map(unitMonthlyRent)).toEqual([6_000, 6_000, 11_000]);
  });
});

describe("status", () => {
  it("counts the cells still marked upcoming", () => {
    expect(upcomingCount(state)).toBe(9);
  });

  it("marks a paid, non-zero cell with a tick and leaves a zero one bare", () => {
    expect(showsTick({ amount: 5_500, status: "Paid" })).toBe(true);
    expect(showsTick({ amount: 0, status: "Paid" })).toBe(false);
    expect(showsTick({ amount: 5_500, status: "Upcoming" })).toBe(false);
  });
});

describe("chart", () => {
  it("scales every bar against the tallest month", () => {
    const bars = chartBars(state);
    expect(bars).toHaveLength(12);
    const peak = Math.max(...bars.map((b) => Math.max(b.rent, b.bill)));
    const tallest = bars.find((b) => b.rent === peak);
    expect(tallest?.rentHeight).toBe("100%");
  });

  it("gives a month with no money a zero-height pair", () => {
    const january = chartBars(state)[0];
    expect(january.rent).toBe(0);
    expect(january.rentHeight).toBe("0%");
  });
});
