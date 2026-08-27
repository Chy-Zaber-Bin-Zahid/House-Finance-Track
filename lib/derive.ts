import { formatAmount } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/seed";
import type { Entry, HouseState, Unit } from "@/lib/types";

const sum = (entries: Entry[]) => entries.reduce((total, e) => total + e.amount, 0);

export function monthBillTotal(state: HouseState, month: number): number {
  return sum(state.bills[month] ?? []);
}

export function monthRentTotal(state: HouseState, month: number): number {
  return state.units.reduce((total, u) => total + (u.rent[month]?.amount ?? 0), 0);
}

export function yearBillTotal(state: HouseState): number {
  return state.bills.reduce((total, row) => total + sum(row), 0);
}

export function yearRentTotal(state: HouseState): number {
  return state.units.reduce((total, u) => total + sum(u.rent), 0);
}

export function billColumnTotal(state: HouseState, billIndex: number): number {
  return state.bills.reduce((total, row) => total + (row[billIndex]?.amount ?? 0), 0);
}

export function unitYearTotal(unit: Unit): number {
  return sum(unit.rent);
}

/** What a unit charges: the figure you set, else the largest month on record. */
export function unitMonthlyRent(unit: Unit): number {
  if (unit.expected != null) return unit.expected;
  return Math.max(0, ...unit.rent.map((e) => e.amount));
}

export function upcomingCount(state: HouseState): number {
  const bills = state.bills.reduce(
    (total, row) => total + row.filter((e) => e.status === "Upcoming").length,
    0,
  );
  const rent = state.units.reduce(
    (total, u) => total + u.rent.filter((e) => e.status === "Upcoming").length,
    0,
  );
  return bills + rent;
}

export function yearHeadline(state: HouseState, currency: string): string {
  const kept = formatAmount(yearRentTotal(state) - yearBillTotal(state), currency);
  const left = upcomingCount(state);
  const tail =
    left === 0
      ? "Everything is marked paid."
      : `${left} ${left === 1 ? "cell is" : "cells are"} still upcoming.`;
  return `You kept ${kept} this year. ${tail}`;
}

export function monthSummary(state: HouseState, month: number, currency: string): string {
  const rent = monthRentTotal(state, month);
  const bill = monthBillTotal(state, month);
  if (rent === 0) {
    return `No rent booked this month. Bills came to ${formatAmount(bill, currency)}.`;
  }
  return `${formatAmount(rent, currency)} in, ${formatAmount(bill, currency)} out — ${formatAmount(
    rent - bill,
    currency,
  )} left over.`;
}

export type ChartBar = {
  month: number;
  short: string;
  rent: number;
  bill: number;
  /** Height as a percentage of the tallest month in the year. */
  rentHeight: string;
  billHeight: string;
};

export function chartBars(state: HouseState): ChartBar[] {
  const rows = MONTH_NAMES.map((name, month) => ({
    month,
    short: name.slice(0, 3),
    rent: monthRentTotal(state, month),
    bill: monthBillTotal(state, month),
  }));
  const peak = Math.max(1, ...rows.map((r) => Math.max(r.rent, r.bill)));
  return rows.map((r) => ({
    ...r,
    rentHeight: `${Math.round((r.rent / peak) * 100)}%`,
    billHeight: `${Math.round((r.bill / peak) * 100)}%`,
  }));
}

/** A tick only earns its place on a paid, non-zero cell. */
export function showsTick(entry: Entry): boolean {
  return entry.status === "Paid" && entry.amount > 0;
}

export function findUnit(state: HouseState, key: string): Unit | undefined {
  return state.units.find((u) => u.key === key);
}
