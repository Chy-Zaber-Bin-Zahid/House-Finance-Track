"use client";

import { cn } from "@/lib/cn";
import type { Status } from "@/lib/types";

const base =
  "cursor-pointer rounded-field border px-[11px] py-[7px] text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2";
const idle = "border-line-13 bg-white text-muted hover:border-line-20";

export function StatusToggle({
  value,
  onChange,
  label,
}: {
  value: Status;
  onChange: (status: Status) => void;
  /** Names what is being marked, for people on a screen reader. */
  label: string;
}) {
  const isPaid = value === "Paid";

  return (
    <div role="group" aria-label={`${label} status`} className="flex shrink-0 gap-1.5">
      <button
        type="button"
        aria-pressed={isPaid}
        onClick={() => onChange("Paid")}
        className={cn(
          base,
          isPaid ? "border-brand/30 bg-brand-tint text-brand-deep" : idle,
        )}
      >
        Paid
      </button>
      <button
        type="button"
        aria-pressed={!isPaid}
        onClick={() => onChange("Upcoming")}
        className={cn(
          base,
          isPaid ? idle : "border-amber/45 bg-amber-tint text-amber-ink",
        )}
      >
        Upcoming
      </button>
    </div>
  );
}
