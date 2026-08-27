import { describe, expect, it } from "vitest";
import type { Sheet } from "@/lib/api";
import { sheetToCsv } from "@/lib/export";
import { billTypeTotal, chartBars, monthBillTotal, monthRentTotal, showsTick, unitTotal, upcomingCount } from "@/lib/sheet";

const water = { id: 1, name: "Water", active: true };
const gas = { id: 2, name: "Gas", active: true };
const internet = { id: 3, name: "Internet", active: false };
const f1b = { id: 10, label: "F1(B)", floor: "back" };
const b1 = { id: 11, label: "B1", floor: "ground" };

const sheet: Sheet = {
  year: 2026,
  billTypes: [water, gas, internet],
  units: [f1b, b1],
  handovers: [],
  months: Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    bills: {
      [water.id]: { amount: i === 0 ? 384 : 0, status: "paid" as const },
      [gas.id]: { amount: 1080, status: "paid" as const },
      [internet.id]: { amount: i === 0 ? 1200 : 0, status: "upcoming" as const },
    },
    rent: {
      [f1b.id]: { amount: i < 6 ? 0 : 5500, status: i < 6 ? ("upcoming" as const) : ("paid" as const), tenantName: "Anwar" },
      [b1.id]: { amount: 11000, status: "paid" as const, tenantName: "Kamal" },
    },
  })),
};

describe("row and column totals", () => {
  it("adds a month's bills and rent", () => {
    expect(monthBillTotal(sheet.months[0])).toBe(384 + 1080 + 1200);
    expect(monthRentTotal(sheet.months[0])).toBe(11_000);
    expect(monthRentTotal(sheet.months[11])).toBe(16_500);
  });

  it("adds a column down the year", () => {
    expect(billTypeTotal(sheet, gas.id)).toBe(1080 * 12);
    expect(unitTotal(sheet, b1.id)).toBe(11_000 * 12);
    expect(unitTotal(sheet, f1b.id)).toBe(5_500 * 6);
  });

  it("counts what is still upcoming", () => {
    expect(upcomingCount(sheet)).toBe(12 + 6);
  });

  it("ticks a paid non-zero cell only", () => {
    expect(showsTick({ amount: 5_500, status: "paid" })).toBe(true);
    expect(showsTick({ amount: 0, status: "paid" })).toBe(false);
    expect(showsTick({ amount: 5_500, status: "upcoming" })).toBe(false);
  });
});

describe("the chart", () => {
  it("scales every bar against the tallest month", () => {
    const bars = chartBars(sheet);
    expect(bars).toHaveLength(12);
    const peak = Math.max(...bars.map((b) => Math.max(b.rent, b.bill)));
    expect(bars.find((b) => Math.max(b.rent, b.bill) === peak)?.rentHeight).toBe("100%");
  });
});

describe("the export", () => {
  const csv = sheetToCsv(sheet);
  const lines = csv.split("\r\n");

  it("heads each column, marking a retired bill", () => {
    expect(lines[0]).toBe("Month,Water,Gas,Internet (retired),Bills total,F1(B),B1,Rent total");
  });

  it("writes one row per month plus a total row", () => {
    expect(lines).toHaveLength(14);
    expect(lines[1].startsWith("January,384,1080,1200,2664,0,11000,11000")).toBe(true);
    expect(lines[13].startsWith("Total individual,")).toBe(true);
  });

  it("totals the columns in the last row", () => {
    const last = lines[13].split(",");
    expect(Number(last[2])).toBe(1080 * 12);
    expect(Number(last[6])).toBe(11_000 * 12);
  });
});
