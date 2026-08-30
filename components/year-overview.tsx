"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

/**
 * One line of the hover readout. The number is the ink the reader came for, so
 * it carries the weight; the series name sits behind a short stroke of its own
 * colour — at this size a filled swatch is data-weight ink doing a label's job.
 */
function Readout({ tone, label, value }: { tone: string; label: string; value: string }) {
  return (
    <span className="flex items-baseline justify-between gap-4">
      <span className="flex items-center gap-[7px] text-[11.5px] whitespace-nowrap text-muted">
        <i aria-hidden="true" className={cn("block h-[2.5px] w-3 rounded-full", tone)} />
        {label}
      </span>
      <span className="num text-[13px] font-semibold text-ink">{value}</span>
    </span>
  );
}

export function YearOverview({ sheet, totals }: { sheet: Sheet; totals: Totals }) {
  const router = useRouter();
  const currency = HOUSE_CONFIG.currency;
  const bars = chartBars(sheet);
  /* Which column the pointer — or the keyboard — is on. */
  const [active, setActive] = useState<number | null>(null);

  return (
    <Card className="mb-6 px-6 pt-[22px] pb-5">
      <div className="mb-[22px] flex flex-wrap items-start gap-[26px]">
        <Stat label="Rent collected" value={formatAmount(totals.rent, currency)} />
        <div className="hidden w-px self-stretch bg-line-9 sm:block" />
        <Stat label="Bills paid" value={formatAmount(totals.bills, currency)} />
        <div className="hidden w-px self-stretch bg-line-9 sm:block" />
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
            onPointerEnter={() => setActive(bar.month)}
            onPointerLeave={() => setActive((m) => (m === bar.month ? null : m))}
            onFocus={() => setActive(bar.month)}
            onBlur={() => setActive((m) => (m === bar.month ? null : m))}
            /* The readout is decorative here: the same figures are on the sheet
             * below, and this label is what a screen reader is read. */
            aria-label={`${bar.short} ${sheet.year}: rent in ${formatAmount(bar.rent, currency)}, bills out ${formatAmount(bar.bill, currency)}, kept ${formatAmount(bar.rent - bar.bill, currency)}`}
            className={cn(
              "relative flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-end gap-[9px] rounded-nav transition-colors focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2",
              active === bar.month && "bg-brand-wash",
            )}
          >
            {active === bar.month ? (
              <span
                aria-hidden="true"
                className={cn(
                  /* Anchored to the top of the plot, not above the column. The
                   * column button is the full height of the chart, so anything
                   * hung off its top edge floats out of the card and over the
                   * toolbar. */
                  "pointer-events-none absolute top-0 z-10 w-[168px] rounded-tile border border-line-9 bg-canvas px-3 py-2.5 text-left shadow-card",
                  /* Kept inside the card at either end rather than centred and
                   * clipped by it. */
                  bar.month <= 2
                    ? "left-0"
                    : bar.month >= 11
                      ? "right-0"
                      : "left-1/2 -translate-x-1/2",
                )}
              >
                <span className="mb-[7px] block text-[11.5px] font-medium text-muted-2">
                  {bar.short} {sheet.year}
                </span>
                <Readout tone="bg-brand" label="Rent in" value={formatAmount(bar.rent, currency)} />
                <Readout tone="bg-bar" label="Bills out" value={formatAmount(bar.bill, currency)} />
                <span className="mt-[7px] flex items-baseline justify-between gap-4 border-t border-line-7 pt-[7px]">
                  <span className="text-[11.5px] text-muted">Kept</span>
                  <span className="num text-[13px] font-semibold text-brand">
                    {formatAmount(bar.rent - bar.bill, currency)}
                  </span>
                </span>
              </span>
            ) : null}
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
