"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type AuditPage,
  type Role,
  type SheetResponse,
  type StoredDocument,
  type Tenancy,
  type Tenant,
  type Unit,
} from "@/lib/api";

/** Server state, all of it, owned by the query cache. */

export function useSheet(year: number) {
  return useQuery({
    queryKey: ["sheet", year],
    queryFn: () => api<SheetResponse>(`/api/sheet/${year}`),
  });
}

export function useUnits() {
  return useQuery({ queryKey: ["units"], queryFn: () => api<{ units: Unit[] }>("/api/units") });
}

export function useTenants() {
  return useQuery({ queryKey: ["tenants"], queryFn: () => api<{ tenants: Tenant[] }>("/api/tenants") });
}

export function useTenancies() {
  return useQuery({
    queryKey: ["tenancies"],
    queryFn: () => api<{ tenancies: Tenancy[] }>("/api/tenancies"),
  });
}

export function useDocuments(tenantId: number | null) {
  return useQuery({
    queryKey: ["documents", tenantId],
    queryFn: () => api<{ documents: StoredDocument[] }>(`/api/files?tenantId=${tenantId}`),
    enabled: tenantId !== null,
  });
}

/**
 * The trail, a page at a time. `before` walks backwards by id rather than by
 * offset, so a line written while someone is reading cannot shift the page
 * under them and hide a row.
 */
export function useAuditLog(options: { before?: number; actor?: string }) {
  const query = new URLSearchParams();
  if (options.before) query.set("before", String(options.before));
  if (options.actor) query.set("actor", options.actor);
  const search = query.toString();

  return useQuery({
    queryKey: ["audit", options.before ?? 0, options.actor ?? ""],
    queryFn: () => api<AuditPage>(`/api/audit${search ? `?${search}` : ""}`),
    /* A log is read, not watched; refetching on every focus is noise. */
    refetchOnWindowFocus: false,
  });
}

/** Anything that writes invalidates what it touched, rather than patching a cache by hand. */
export function useInvalidate() {
  const client = useQueryClient();
  return (...keys: string[]) => {
    for (const key of keys) void client.invalidateQueries({ queryKey: [key] });
  };
}

export function useSetEntry() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: {
      kind: "rent" | "bill";
      targetId: number;
      year: number;
      month: number;
      amount?: number;
      status?: "paid" | "upcoming";
    }) => api("/api/entries", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidate("sheet", "month"),
  });
}

export function useCreateUnit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { label: string; floor: string }) =>
      api("/api/units", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidate("units", "sheet"),
  });
}

export function useCreateTenant() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { name: string; phone: string }) =>
      api("/api/tenants", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidate("tenants"),
  });
}

export function useCreateTenancy() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: {
      unitId: number;
      tenantId: number;
      start: { year: number; month: number };
      end: { year: number; month: number } | null;
      expectedRent: number;
    }) => api("/api/tenancies", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidate("tenancies", "sheet"),
  });
}

export function useEndTenancy() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, end }: { id: number; end: { year: number; month: number } }) =>
      api(`/api/tenancies/${id}`, { method: "PATCH", body: JSON.stringify({ end }) }),
    onSuccess: () => invalidate("tenancies", "sheet"),
  });
}

/**
 * The rent changed from a month on. The server splits the tenancy, so the
 * tenancy list and the sheet both move under this.
 */
export function useChangeRent() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      from,
      expectedRent,
    }: {
      id: number;
      from: { year: number; month: number };
      expectedRent: number;
    }) =>
      api(`/api/tenancies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ changeRent: { from, expectedRent } }),
      }),
    onSuccess: () => invalidate("tenancies", "sheet"),
  });
}

/** The figure was mistyped: correct it across every month the tenancy covers. */
export function useCorrectRent() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, expectedRent }: { id: number; expectedRent: number }) =>
      api(`/api/tenancies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ expectedRent }),
      }),
    onSuccess: () => invalidate("tenancies", "sheet"),
  });
}

export function useCreateBillType() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { name: string }) =>
      api("/api/bill-types", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidate("sheet", "billTypes"),
  });
}

export function useSetBillTypeActive() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      api(`/api/bill-types/${id}`, { method: "PATCH", body: JSON.stringify({ active }) }),
    onSuccess: () => invalidate("sheet", "billTypes"),
  });
}

export function useUnlockYear() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (year: number) =>
      api<{ unlockedYear: number; relocked: number | null }>(`/api/years/${year}/unlock`, {
        method: "POST",
      }),
    onSuccess: () => invalidate("sheet", "me"),
  });
}

export type YearState = {
  year: number;
  isCurrent: boolean;
  editable: boolean;
  canUnlock: boolean;
};

/**
 * Who the browser is talking as, and whether the server considers the given
 * year editable. The year is asked for rather than assumed, so the answer comes
 * from the server's clock rather than the device's.
 */
export function useMe(year?: number) {
  return useQuery({
    queryKey: ["me", year ?? null],
    queryFn: () =>
      api<{
        actor: { email: string; role: Role; unlockedYear: number | null } | null;
        year: YearState;
      }>(`/api/me${year === undefined ? "" : `?year=${year}`}`),
  });
}
