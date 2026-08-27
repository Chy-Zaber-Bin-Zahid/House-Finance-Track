import { PaidTickIcon } from "@/components/icons";
import { UpcomingDot } from "@/components/ui";
import { formatAmount } from "@/lib/format";
import { showsTick } from "@/lib/sheet";

/** One money cell in the year sheet: its marker, then its amount. */
export function AmountCell({
  cell,
  currency,
}: {
  cell: { amount: number; status: string };
  currency: string;
}) {
  return (
    <span className="inline-flex items-center justify-end gap-[7px]">
      {showsTick(cell) ? <PaidTickIcon /> : null}
      {cell.status === "upcoming" ? <UpcomingDot /> : null}
      <span className={cell.amount === 0 ? "text-muted" : "text-ink"}>
        {formatAmount(cell.amount, currency)}
      </span>
      <span className="sr-only">{cell.status === "paid" ? "Paid" : "Upcoming"}</span>
    </span>
  );
}
