"use client";

import { create } from "zustand";

/**
 * Client-only state: things no other person or server can change, and which
 * never round-trip. Anything that came from the server lives in the query
 * cache instead — mirroring it here is how the two drift apart.
 */
type ViewState = {
  /** Which year the sheet is showing. Drives the query key, not a second copy of the data. */
  year: number;
  setYear: (year: number) => void;

  /** Forms that are open but not yet submitted. */
  unitFormOpen: boolean;
  setUnitFormOpen: (open: boolean) => void;
  tenantFormOpen: boolean;
  setTenantFormOpen: (open: boolean) => void;
};

export const useViewState = create<ViewState>((set) => ({
  year: new Date().getFullYear(),
  setYear: (year) => set({ year }),
  unitFormOpen: false,
  setUnitFormOpen: (unitFormOpen) => set({ unitFormOpen }),
  tenantFormOpen: false,
  setTenantFormOpen: (tenantFormOpen) => set({ tenantFormOpen }),
}));
