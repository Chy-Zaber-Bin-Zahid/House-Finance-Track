"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { DocumentPanel } from "@/components/document-panel";
import { useDocuments, useInvalidate, useMe } from "@/components/hooks";
import { CheckIcon, ChevronLeftIcon } from "@/components/icons";
import { ImageSlot } from "@/components/image-slot";
import {
  ButtonLink,
  Card,
  Field,
  Label,
  Loading,
  Notice,
  Pill,
  TextArea,
  UpcomingDot,
} from "@/components/ui";
import { api, ApiError, type MonthRef, type StoredDocument } from "@/lib/api";
import { HOUSE_CONFIG } from "@/lib/config";
import { formatAmount, parseAmount } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/seed";

type Held = {
  id: number;
  unitLabel: string;
  expectedRent: number;
  start: MonthRef;
  end: MonthRef | null;
  collected: number;
  entries: { year: number; month: number; amount: number; status: "paid" | "upcoming" }[];
};

type HistoryResponse = {
  tenant: { id: number; name: string; phone: string; notes: string };
  tenancies: Held[];
};

const monthLabel = (m: MonthRef) => `${MONTH_NAMES[m.month - 1].slice(0, 3)} ${m.year}`;

export function TenantScreen({ tenantId }: { tenantId: number }) {
  const invalidate = useInvalidate();
  const { data: me } = useMe();
  const editable = me?.actor?.role === "owner" || me?.actor?.role === "super_admin";

  const history = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => api<HistoryResponse>(`/api/tenants/${tenantId}`),
  });
  const docs = useDocuments(tenantId);

  const nameId = useId();
  const phoneId = useId();
  const notesId = useId();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!history.data) return;
    setName(history.data.tenant.name);
    setPhone(history.data.tenant.phone);
    setNotes(history.data.tenant.notes);
  }, [history.data]);

  if (history.isPending) return <Loading label="Loading the tenant…" />;

  if (history.error) {
    return (
      <section aria-label="Tenant">
        <ButtonLink href="/units" className="mb-5">
          <ChevronLeftIcon className="size-3.5" />
          All units
        </ButtonLink>
        <Notice tone="error">
          {history.error instanceof ApiError ? history.error.message : "Could not load this tenant."}
        </Notice>
      </section>
    );
  }

  const { tenant, tenancies } = history.data;
  const currency = HOUSE_CONFIG.currency;
  const photo: StoredDocument | null = docs.data?.documents.find((d) => d.kind === "photo") ?? null;
  const current = tenancies.find((t) => t.end === null);
  const collected = tenancies.reduce((total, t) => total + t.collected, 0);

  async function save(patch: Record<string, string>) {
    setSaveError(null);
    try {
      await api(`/api/tenants/${tenantId}`, { method: "PATCH", body: JSON.stringify(patch) });
      invalidate("tenant", "tenants", "tenancies");
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "That change did not save.");
    }
  }

  return (
    <section aria-label="Tenant">
      <ButtonLink href="/units" className="mb-5">
        <ChevronLeftIcon className="size-3.5" />
        All units
      </ButtonLink>

      {saveError ? (
        <div className="mb-5">
          <Notice tone="error">{saveError}</Notice>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-[26px] lg:grid-cols-[312px_minmax(0,1fr)]">
        <Card className="px-[22px] pt-5 pb-[22px]">
          <ImageSlot
            tenantId={tenantId}
            photo={photo}
            editable={editable}
            placeholder="Drop a photo of this tenant"
            className="mb-[17px] aspect-square w-full rounded-tile"
          />

          <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{tenant.name}</h1>
            {current ? (
              <Pill className="bg-brand-tint text-brand-deep">{current.unitLabel}</Pill>
            ) : (
              <Pill className="bg-chip text-slate">Not renting</Pill>
            )}
          </div>

          <div className="flex flex-col gap-[13px]">
            <div>
              <Label htmlFor={nameId}>Name</Label>
              <Field
                id={nameId}
                value={name}
                disabled={!editable}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name !== tenant.name && save({ name })}
              />
            </div>
            <div>
              <Label htmlFor={phoneId}>Phone</Label>
              <Field
                id={phoneId}
                type="tel"
                value={phone}
                disabled={!editable}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => phone !== tenant.phone && save({ phone })}
              />
            </div>
            {current ? (
              <div>
                <Label>Monthly rent</Label>
                <p className="num text-left text-sm text-muted">
                  {formatAmount(current.expectedRent, currency)} · set on the tenancy
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-[18px] flex items-baseline justify-between border-t border-line-7 pt-4">
            <span className="text-[13px] text-muted">Collected, all time</span>
            <span className="num text-[19px] font-semibold">{formatAmount(collected, currency)}</span>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <DocumentPanel
            tenantId={tenantId}
            documents={docs.data?.documents ?? []}
            editable={editable}
          />

          {tenancies.length === 0 ? (
            <Card className="px-[22px] py-6">
              <p className="text-center text-[13px] text-muted">
                This tenant has never been assigned to a unit. Assign them on{" "}
                <Link href="/units">Units &amp; tenants</Link>.
              </p>
            </Card>
          ) : (
            tenancies.map((held) => (
              <Card key={held.id} className="px-[22px] pt-[19px] pb-2">
                <div className="mb-2.5 flex flex-wrap items-baseline gap-2.5">
                  <h2 className="text-[17px] font-semibold">{held.unitLabel}</h2>
                  <span className="text-[13px] text-muted">
                    {monthLabel(held.start)} – {held.end ? monthLabel(held.end) : "now"}
                  </span>
                  <span className="num ml-auto text-[15px] font-semibold">
                    {formatAmount(held.collected, currency)}
                  </span>
                </div>
                {held.entries.length === 0 ? (
                  <p className="pb-4 text-[13px] text-muted-2">Nothing recorded yet.</p>
                ) : (
                  <table className="w-full border-collapse">
                    <tbody>
                      {held.entries.map((entry) => (
                        <tr
                          key={`${entry.year}-${entry.month}`}
                          className="border-b border-line-5 last:border-b-0"
                        >
                          <th
                            scope="row"
                            className="w-[150px] p-[11px] pl-0 text-left text-sm font-normal"
                          >
                            {MONTH_NAMES[entry.month - 1]} {entry.year}
                          </th>
                          <td className="num w-[130px] p-[11px] text-right text-sm">
                            {formatAmount(entry.amount, currency)}
                          </td>
                          <td className="p-[11px] text-sm">
                            {entry.status === "paid" ? (
                              <Pill className="bg-brand-tint text-brand-deep">
                                <CheckIcon />
                                Paid
                              </Pill>
                            ) : (
                              <Pill className="bg-amber-tint text-amber-ink">
                                <UpcomingDot className="size-[7px]" />
                                Upcoming
                              </Pill>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            ))
          )}

          <Card className="px-[22px] pt-[19px] pb-[22px]">
            <Label htmlFor={notesId}>
              <span className="text-[17px] font-semibold text-ink">Notes</span>
            </Label>
            <TextArea
              id={notesId}
              className="mt-3 min-h-[84px]"
              placeholder="Anything worth remembering about this tenant…"
              value={notes}
              disabled={!editable}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== tenant.notes && save({ notes })}
            />
          </Card>
        </div>
      </div>
    </section>
  );
}
