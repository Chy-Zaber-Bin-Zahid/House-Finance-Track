import type { MonthRow, Sheet } from "@/lib/api";

/**
 * Pure calculation over what the server sends. The server owns the year and
 * month totals; these are the per-row and per-column figures a screen needs
 * while rendering, and they stay testable without a database.
 */

export function monthBillTotal(row: MonthRow): number {
  return Object.values(row.bills).reduce((total, cell) => total + cell.amount, 0);
}

export function monthRentTotal(row: MonthRow): number {
  return Object.values(row.rent).reduce((total, cell) => total + cell.amount, 0);
}

export function billTypeTotal(sheet: Sheet, billTypeId: number): number {
  return sheet.months.reduce((total, row) => total + (row.bills[billTypeId]?.amount ?? 0), 0);
}

export function unitTotal(sheet: Sheet, unitId: number): number {
  return sheet.months.reduce((total, row) => total + (row.rent[unitId]?.amount ?? 0), 0);
}

export function upcomingCount(sheet: Sheet): number {
  return sheet.months.reduce(
    (total, row) =>
      total +
      Object.values(row.bills).filter((c) => c.status === "upcoming").length +
      Object.values(row.rent).filter((c) => c.status === "upcoming").length,
    0,
  );
}

export type ChartBar = {
  month: number;
  short: string;
  rent: number;
  bill: number;
  rentHeight: string;
  billHeight: string;
};

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function chartBars(sheet: Sheet): ChartBar[] {
  const rows = sheet.months.map((row) => ({
    month: row.month,
    short: SHORT[row.month - 1],
    rent: monthRentTotal(row),
    bill: monthBillTotal(row),
  }));
  const peak = Math.max(1, ...rows.map((r) => Math.max(r.rent, r.bill)));
  return rows.map((r) => ({
    ...r,
    rentHeight: `${Math.round((r.rent / peak) * 100)}%`,
    billHeight: `${Math.round((r.bill / peak) * 100)}%`,
  }));
}

/** A paid, non-zero cell earns a tick; a zero one does not. */
export function showsTick(cell: { amount: number; status: string }): boolean {
  return cell.status === "paid" && cell.amount > 0;
}
