import { PaidTickIcon } from "@/components/icons";
import { UpcomingDot } from "@/components/ui";
import { showsTick } from "@/lib/derive";
import { formatAmount } from "@/lib/format";
import type { Entry } from "@/lib/types";

/** One money cell in the year sheet: its marker, then its amount. */
export function AmountCell({ entry, currency }: { entry: Entry; currency: string }) {
  return (
    <span className="inline-flex items-center justify-end gap-[7px]">
      {showsTick(entry) ? <PaidTickIcon /> : null}
      {entry.status === "Upcoming" ? <UpcomingDot /> : null}
      <span className={entry.amount === 0 ? "text-muted" : "text-ink"}>
        {formatAmount(entry.amount, currency)}
      </span>
      <span className="sr-only">{entry.status}</span>
    </span>
  );
}
