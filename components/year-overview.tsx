"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { HOUSE_CONFIG } from "@/lib/config";
import { formatAmount } from "@/lib/format";
import type { Sheet, Totals } from "@/lib/api";
import { chartBars } from "@/lib/sheet";

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="mb-[5px] text-[12.5px] font-medium text-muted">{label}</div>
      <div
        className={cn(
          "num text-left text-[34px] leading-none font-semibold tracking-[-0.028em]",
          accent && "text-brand",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function YearOverview({ sheet, totals }: { sheet: Sheet; totals: Totals }) {
  const router = useRouter();
  const currency = HOUSE_CONFIG.currency;
  const bars = chartBars(sheet);

  return (
    <Card className="mb-6 px-6 pt-[22px] pb-5">
      <div className="mb-[22px] flex flex-wrap items-start gap-[26px]">
        <Stat label="Rent collected" value={formatAmount(totals.rent, currency)} />
        <div className="w-px self-stretch bg-line-9" />
        <Stat label="Bills paid" value={formatAmount(totals.bills, currency)} />
        <div className="w-px self-stretch bg-line-9" />
        <Stat label="You kept" value={formatAmount(totals.kept, currency)} accent />
        <div className="ml-auto flex items-center gap-4 pt-5 text-[12.5px] text-muted">
          <span className="flex items-center gap-[7px]">
            <i aria-hidden="true" className="block size-2.5 rounded-[3px] bg-brand" />
            Rent in
          </span>
          <span className="flex items-center gap-[7px]">
            <i aria-hidden="true" className="block size-2.5 rounded-[3px] bg-bar" />
            Bills out
          </span>
        </div>
      </div>

      <div className="flex h-[172px] items-end gap-2.5">
        {bars.map((bar) => (
          <button
            key={bar.month}
            type="button"
            onClick={() => router.push(`/month/${sheet.year}/${bar.month}`)}
            title={`${bar.short}: rent ${formatAmount(bar.rent, currency)}, bills ${formatAmount(bar.bill, currency)}`}
            className="flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-end gap-[9px] rounded-nav focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
          >
            <span className="flex h-[130px] w-full items-end justify-center gap-1">
              <span className="flex h-full w-[42%] max-w-[26px] items-end">
                {bar.rent > 0 ? (
                  <span
                    className="block min-h-[3px] w-full rounded-t-[5px] rounded-b-[2px] bg-brand"
                    style={{ height: bar.rentHeight }}
                  />
                ) : null}
              </span>
              <span className="flex h-full w-[42%] max-w-[26px] items-end">
                {bar.bill > 0 ? (
                  <span
                    className="block min-h-[3px] w-full rounded-t-[5px] rounded-b-[2px] bg-bar"
                    style={{ height: bar.billHeight }}
                  />
                ) : null}
              </span>
            </span>
            <span className="text-[11.5px] font-medium whitespace-nowrap text-muted-2">
              {bar.short}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
