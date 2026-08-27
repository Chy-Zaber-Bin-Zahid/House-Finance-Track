"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddUnitForm } from "@/components/add-unit-form";
import { useHouse } from "@/components/house-store";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { Button, Card, PageHeading } from "@/components/ui";
import { cn } from "@/lib/cn";
import { unitMonthlyRent, unitYearTotal } from "@/lib/derive";
import { countLabel, formatAmount, initialsOf } from "@/lib/format";

const th = "border-b border-line-9 px-[11px] py-[9px] text-[11.5px] font-medium text-muted whitespace-nowrap";
const td = "p-[11px] text-sm";

export function UnitsScreen() {
  const { state, config } = useHouse();
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);

  const count = countLabel(state.units.length, "unit", "units");

  return (
    <section aria-label="Units and tenants">
      <PageHeading
        title="Units and tenants"
        subtitle={`${count} · tap one to add a photo and documents`}
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <PlusIcon className="size-3.5" />
            Add a unit
          </Button>
        }
      />

      {formOpen ? <AddUnitForm onClose={() => setFormOpen(false)} submitLabel="Add it" /> : null}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th scope="col" className={cn(th, "w-[92px] pl-5 text-left")}>
                  Unit
                </th>
                <th scope="col" className={cn(th, "w-[186px] text-left")}>
                  Tenant
                </th>
                <th scope="col" className={cn(th, "min-w-[158px] text-left")}>
                  Where it is
                </th>
                <th scope="col" className={cn(th, "w-[118px] text-right")}>
                  Monthly rent
                </th>
                <th scope="col" className={cn(th, "w-[126px] text-right")}>
                  Collected {config.yearLabel}
                </th>
                <th scope="col" className={cn(th, "w-[104px] text-left")}>
                  Documents
                </th>
                <th scope="col" className={cn(th, "w-10 pr-5")}>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {state.units.map((unit, i) => (
                <tr
                  key={unit.key}
                  onClick={() => router.push(`/units/${unit.key}`)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-hover-row",
                    i < state.units.length - 1 && "border-b border-line-5",
                  )}
                >
                  <th scope="row" className={cn(td, "pl-5 text-left font-semibold")}>
                    <Link
                      href={`/units/${unit.key}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-ink hover:text-brand"
                    >
                      {unit.label}
                    </Link>
                  </th>
                  <td className={td}>
                    <span className="inline-flex items-center gap-[11px]">
                      <span
                        aria-hidden="true"
                        className="grid size-[30px] shrink-0 place-items-center rounded-full bg-avatar text-[11.5px] font-semibold text-slate"
                      >
                        {initialsOf(unit.name)}
                      </span>
                      {unit.name}
                    </span>
                  </td>
                  <td className={cn(td, "whitespace-nowrap text-muted")}>{unit.floor}</td>
                  <td className={cn(td, "num text-right")}>
                    {formatAmount(unitMonthlyRent(unit), config.currency)}
                  </td>
                  <td className={cn(td, "num text-right font-medium")}>
                    {formatAmount(unitYearTotal(unit), config.currency)}
                  </td>
                  <td className={cn(td, "text-[13px] text-muted")}>
                    {unit.docs.length === 0
                      ? "None yet"
                      : countLabel(unit.docs.length, "file", "files")}
                  </td>
                  <td className={cn(td, "pr-5 text-right text-chevron")}>
                    <ChevronRightIcon className="ml-auto size-[15px]" />
                  </td>
                </tr>
              ))}
              {state.units.length === 0 ? (
                <tr>
                  <td colSpan={7} className={cn(td, "px-5 py-6 text-center text-[13px] text-muted")}>
                    No units yet. Add one and it becomes a rent column on the year sheet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
