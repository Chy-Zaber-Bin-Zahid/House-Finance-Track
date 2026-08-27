import { billColumnTotal, monthBillTotal, monthRentTotal, unitYearTotal, yearBillTotal, yearRentTotal } from "@/lib/derive";
import { BILL_KINDS, MONTH_NAMES } from "@/lib/seed";
import type { HouseState } from "@/lib/types";

function escapeCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The whole sheet as CSV — Excel and Sheets both open it directly. */
export function sheetToCsv(state: HouseState): string {
  const rows: (string | number)[][] = [];

  rows.push([
    "Month",
    ...BILL_KINDS.map((b) => b.label),
    "Bills total",
    ...state.units.map((u) => u.label),
    "Rent total",
  ]);

  MONTH_NAMES.forEach((name, month) => {
    rows.push([
      name,
      ...state.bills[month].map((e) => e.amount),
      monthBillTotal(state, month),
      ...state.units.map((u) => u.rent[month]?.amount ?? 0),
      monthRentTotal(state, month),
    ]);
  });

  rows.push([
    "Total individual",
    ...BILL_KINDS.map((_, i) => billColumnTotal(state, i)),
    yearBillTotal(state),
    ...state.units.map(unitYearTotal),
    yearRentTotal(state),
  ]);

  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  /* The BOM is what tells Excel the file is UTF-8, so the currency survives. */
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
