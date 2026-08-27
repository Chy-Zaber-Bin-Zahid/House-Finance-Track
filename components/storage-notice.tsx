"use client";

import { useHouse } from "@/components/house-store";

export function StorageNotice() {
  const { storageWarning } = useHouse();
  if (!storageWarning) return null;

  return (
    <p
      role="status"
      className="mb-5 rounded-field border border-amber/45 bg-amber-tint px-[13px] py-2.5 text-[13px] text-amber-ink"
    >
      {storageWarning}
    </p>
  );
}
