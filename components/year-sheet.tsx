"use client";

import Link from "next/link";
import { AmountCell } from "@/components/amount-cell";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { HOUSE_CONFIG } from "@/lib/config";
import { formatAmount } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/seed";
import type { Sheet, Totals } from "@/lib/api";
import { billTypeTotal, monthBillTotal, monthRentTotal, unitTotal } from "@/lib/sheet";

const th =
  "border-b border-line-9 px-[11px] py-[9px] text-[11.5px] font-medium text-muted whitespace-nowrap";
const td = "p-[11px] text-sm";
const groupTh = "text-center text-[11px] tracking-[0.08em] text-muted-2 uppercase";
const totalCol = "num bg-zebra text-right font-semibold";
const footTd = "border-t border-line-9 p-[11px] text-sm";

export function YearSheet({ sheet, totals }: { sheet: Sheet; totals: Totals }) {
  const currency = HOUSE_CONFIG.currency;
  const billCount = sheet.billTypes.length;
  const handoverUnits = new Set(sheet.handovers.map((h) => h.unitId));

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1020px] border-collapse">
          <caption className="sr-only">
            Bills paid and rent collected for every month of {sheet.year}
          </caption>
          <thead>
            <tr>
              <th scope="col" rowSpan={2} className={cn(th, "w-28 pl-5 text-left align-bottom")}>
                Month
              </th>
              <th
                scope="colgroup"
                colSpan={Math.max(1, billCount) + 1}
                className={cn(th, groupTh, "border-l border-line-7")}
              >
                Bills
              </th>
              <th
                scope="colgroup"
                colSpan={sheet.units.length + 1}
                className={cn(th, groupTh)}
              >
                Rent
              </th>
            </tr>
            <tr>
              {sheet.billTypes.map((bill, i) => (
                <th
                  key={bill.id}
                  scope="col"
                  className={cn(th, "text-right", i === 0 && "border-l border-line-7")}
                >
                  {bill.name}
                  {!bill.active ? <span className="ml-1 text-muted-2">(retired)</span> : null}
                </th>
              ))}
              {billCount === 0 ? <th className={cn(th, "border-l border-line-7")} /> : null}
              <th scope="col" className={cn(th, "border-r border-line-7 text-right")}>
                Total
              </th>
              {sheet.units.map((unit) => (
                <th key={unit.id} scope="col" className={cn(th, "text-right")}>
                  {unit.label}
                  {handoverUnits.has(unit.id) ? (
                    <span
                      title="More than one tenancy this year"
                      className="ml-1 text-muted-2"
                      aria-label="changed hands this year"
                    >
                      ↹
                    </span>
                  ) : null}
                </th>
              ))}
              <th scope="col" className={cn(th, "pr-5 text-right")}>
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {sheet.months.map((row, i) => (
              <tr
                key={row.month}
                className={cn(
                  "transition-colors hover:bg-hover-row",
                  i < sheet.months.length - 1 && "border-b border-line-5",
                )}
              >
                <th scope="row" className={cn(td, "pl-5 text-left font-medium")}>
                  <Link href={`/month/${sheet.year}/${row.month}`} className="text-ink hover:text-brand">
                    {MONTH_NAMES[row.month - 1]}
                  </Link>
                </th>

                {sheet.billTypes.map((bill, k) => (
                  <td
                    key={bill.id}
                    className={cn(td, "num text-right", k === 0 && "border-l border-line-7")}
                  >
                    <AmountCell cell={row.bills[bill.id]} currency={currency} />
                  </td>
                ))}
                {billCount === 0 ? <td className={cn(td, "border-l border-line-7")} /> : null}
                <td className={cn(td, totalCol, "border-r border-line-7")}>
                  {formatAmount(monthBillTotal(row), currency)}
                </td>

                {sheet.units.map((unit) => (
                  <td key={unit.id} className={cn(td, "num text-right")}>
                    <AmountCell cell={row.rent[unit.id]} currency={currency} />
                  </td>
                ))}
                <td className={cn(td, totalCol, "pr-5")}>
                  {formatAmount(monthRentTotal(row), currency)}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <th scope="row" className={cn(footTd, "pl-5 text-left font-semibold")}>
                Total individual
              </th>
              {sheet.billTypes.map((bill, i) => (
                <td
                  key={bill.id}
                  className={cn(footTd, "num text-right font-semibold", i === 0 && "border-l border-line-7")}
                >
                  {formatAmount(billTypeTotal(sheet, bill.id), currency)}
                </td>
              ))}
              {billCount === 0 ? <td className={cn(footTd, "border-l border-line-7")} /> : null}
              <td className={cn(footTd, totalCol, "border-r border-line-7")}>
                {formatAmount(totals.bills, currency)}
              </td>
              {sheet.units.map((unit) => (
                <td key={unit.id} className={cn(footTd, "num text-right font-semibold")}>
                  {formatAmount(unitTotal(sheet, unit.id), currency)}
                </td>
              ))}
              <td className={cn(footTd, totalCol, "pr-5")}>{formatAmount(totals.rent, currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
