"use client";

import { useId } from "react";
import { StatusToggle } from "@/components/status-toggle";
import { Field } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Entry, Status } from "@/lib/types";

/** A label, an amount you can type into, and its paid/upcoming switch. */
export function EntryRow({
  label,
  entry,
  placeholder,
  boldLabel = false,
  onAmountChange,
  onStatusChange,
}: {
  label: string;
  entry: Entry;
  placeholder: string;
  boldLabel?: boolean;
  onAmountChange: (value: string) => void;
  onStatusChange: (status: Status) => void;
}) {
  const inputId = useId();

  return (
    <div className="flex items-center gap-[13px]">
      <label
        htmlFor={inputId}
        className={cn("w-[74px] shrink-0 text-sm", boldLabel ? "font-semibold" : "font-medium")}
      >
        {label}
      </label>
      <Field
        id={inputId}
        inputMode="numeric"
        className="num min-w-0 flex-1"
        value={entry.amount === 0 ? "" : String(entry.amount)}
        placeholder={placeholder}
        onChange={(e) => onAmountChange(e.target.value)}
      />
      <StatusToggle value={entry.status} onChange={onStatusChange} label={label} />
    </div>
  );
}
