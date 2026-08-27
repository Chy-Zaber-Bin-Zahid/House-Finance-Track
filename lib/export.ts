import type { Sheet } from "@/lib/api";
import { MONTH_NAMES } from "@/lib/seed";
import { billTypeTotal, monthBillTotal, monthRentTotal, unitTotal } from "@/lib/sheet";

function escapeCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The whole sheet as CSV — Excel and Sheets both open it directly. */
export function sheetToCsv(sheet: Sheet, _currency?: string): string {
  const rows: (string | number)[][] = [];

  rows.push([
    "Month",
    ...sheet.billTypes.map((b) => (b.active ? b.name : `${b.name} (retired)`)),
    "Bills total",
    ...sheet.units.map((u) => u.label),
    "Rent total",
  ]);

  for (const row of sheet.months) {
    rows.push([
      MONTH_NAMES[row.month - 1],
      ...sheet.billTypes.map((b) => row.bills[b.id]?.amount ?? 0),
      monthBillTotal(row),
      ...sheet.units.map((u) => row.rent[u.id]?.amount ?? 0),
      monthRentTotal(row),
    ]);
  }

  rows.push([
    "Total individual",
    ...sheet.billTypes.map((b) => billTypeTotal(sheet, b.id)),
    sheet.months.reduce((total, row) => total + monthBillTotal(row), 0),
    ...sheet.units.map((u) => unitTotal(sheet, u.id)),
    sheet.months.reduce((total, row) => total + monthRentTotal(row), 0),
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
