"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AmountCell } from "@/components/amount-cell";
import { useHouse } from "@/components/house-store";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  billColumnTotal,
  monthBillTotal,
  monthRentTotal,
  unitYearTotal,
  yearBillTotal,
  yearRentTotal,
} from "@/lib/derive";
import { formatAmount } from "@/lib/format";
import { BILL_KINDS, MONTH_NAMES } from "@/lib/seed";

const th = "border-b border-line-9 px-[11px] py-[9px] text-[11.5px] font-medium text-muted whitespace-nowrap";
const td = "p-[11px] text-sm";
const groupTh = "text-center text-[11px] tracking-[0.08em] text-muted-2 uppercase";
const totalCol = "num bg-zebra text-right font-semibold";
const footTd = "border-t border-line-9 p-[11px] text-sm";

export function YearSheet() {
  const { state, config, rememberMonth } = useHouse();
  const router = useRouter();
  const { units, bills } = state;

  const yearBill = yearBillTotal(state);
  const yearRent = yearRentTotal(state);

  function openMonth(month: number) {
    rememberMonth(month);
    router.push(`/month/${month + 1}`);
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1020px] border-collapse">
          <caption className="sr-only">
            Bills paid and rent collected for every month of {config.yearLabel}
          </caption>
          <thead>
            <tr>
              <th scope="col" rowSpan={2} className={cn(th, "w-28 pl-5 text-left align-bottom")}>
                Month
              </th>
              <th scope="colgroup" colSpan={4} className={cn(th, groupTh, "border-l border-line-7")}>
                Bills
              </th>
              <th scope="colgroup" colSpan={units.length + 1} className={cn(th, groupTh)}>
                Rent
              </th>
            </tr>
            <tr>
              {BILL_KINDS.map((bill, i) => (
                <th
                  key={bill.key}
                  scope="col"
                  className={cn(th, "text-right", i === 0 && "border-l border-line-7")}
                >
                  {bill.label}
                </th>
              ))}
              <th scope="col" className={cn(th, "border-r border-line-7 text-right")}>
                Total
              </th>
              {units.map((unit) => (
                <th key={unit.key} scope="col" className={cn(th, "text-right")}>
                  {unit.label}
                </th>
              ))}
              <th scope="col" className={cn(th, "pr-5 text-right")}>
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {MONTH_NAMES.map((name, month) => (
              <tr
                key={name}
                onClick={() => openMonth(month)}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-hover-row",
                  month < MONTH_NAMES.length - 1 && "border-b border-line-5",
                )}
              >
                <th scope="row" className={cn(td, "pl-5 text-left font-medium")}>
                  <Link
                    href={`/month/${month + 1}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-ink hover:text-brand"
                  >
                    {name}
                  </Link>
                </th>

                {bills[month].map((entry, i) => (
                  <td
                    key={BILL_KINDS[i].key}
                    className={cn(td, "num text-right", i === 0 && "border-l border-line-7")}
                  >
                    <AmountCell entry={entry} currency={config.currency} />
                  </td>
                ))}
                <td className={cn(td, totalCol, "border-r border-line-7")}>
                  {formatAmount(monthBillTotal(state, month), config.currency)}
                </td>

                {units.map((unit) => (
                  <td key={unit.key} className={cn(td, "num text-right")}>
                    <AmountCell entry={unit.rent[month]} currency={config.currency} />
                  </td>
                ))}
                <td className={cn(td, totalCol, "pr-5")}>
                  {formatAmount(monthRentTotal(state, month), config.currency)}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <th scope="row" className={cn(footTd, "pl-5 text-left font-semibold")}>
                Total individual
              </th>
              {BILL_KINDS.map((bill, i) => (
                <td
                  key={bill.key}
                  className={cn(
                    footTd,
                    "num text-right font-semibold",
                    i === 0 && "border-l border-line-7",
                  )}
                >
                  {formatAmount(billColumnTotal(state, i), config.currency)}
                </td>
              ))}
              <td className={cn(footTd, totalCol, "border-r border-line-7")}>
                {formatAmount(yearBill, config.currency)}
              </td>
              {units.map((unit) => (
                <td key={unit.key} className={cn(footTd, "num text-right font-semibold")}>
                  {formatAmount(unitYearTotal(unit), config.currency)}
                </td>
              ))}
              <td className={cn(footTd, totalCol, "pr-5")}>
                {formatAmount(yearRent, config.currency)}
              </td>
            </tr>

            <tr>
              <th scope="row" className={cn(td, "pl-5 text-left text-[13px] font-normal text-muted")}>
                Year
              </th>
              <td colSpan={3} className={cn(td, "border-l border-line-7 text-[13px] text-muted")}>
                Total yearly bill
              </td>
              <td
                className={cn(td, totalCol, "border-r border-line-7 text-[17px]")}
              >
                {formatAmount(yearBill, config.currency)}
              </td>
              {units.length > 0 ? (
                <td colSpan={units.length} className={cn(td, "text-[13px] text-muted")}>
                  Total yearly rent
                </td>
              ) : null}
              <td className={cn(td, totalCol, "pr-5 text-[17px]")}>
                {formatAmount(yearRent, config.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
