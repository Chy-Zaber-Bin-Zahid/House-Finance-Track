"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe, useSetEntry } from "@/components/hooks";
import { useQuery } from "@tanstack/react-query";
import { StatusToggle } from "@/components/status-toggle";
import { ButtonLink, Card, Field, Loading, Notice, PageHeading, Select } from "@/components/ui";
import { api, ApiError, type Cell, type MonthRow } from "@/lib/api";
import { cn } from "@/lib/cn";
import { HOUSE_CONFIG } from "@/lib/config";
import { formatAmount, parseAmount } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/seed";
import { monthBillTotal, monthRentTotal } from "@/lib/sheet";

type MonthResponse = {
  year: number;
  month: number;
  billTypes: { id: number; name: string; active: boolean }[];
  tenancies: { id: number; unitId: number; unitLabel: string; tenantName: string; expectedRent: number }[];
  totals: { rent: number; bills: number; kept: number };
  cells: MonthRow;
};

export function MonthScreen({ year, month }: { year: number; month: number }) {
  const router = useRouter();
  const { data: me } = useMe(year);
  const setEntry = useSetEntry();
  /* Which row's last save failed, so the error lands on the input the person
   * edited rather than only in a banner above a grid of many rows. */
  const [failed, setFailed] = useState<string | null>(null);

  const { data, isPending, error } = useQuery({
    queryKey: ["month", year, month],
    queryFn: () => api<MonthResponse>(`/api/months/${year}/${month}`),
  });

  const currency = HOUSE_CONFIG.currency;
  const editable = me?.year?.editable ?? false;
  const canEdit = me?.actor?.role === "owner" || me?.actor?.role === "super_admin";

  if (isPending) return <Loading label="Loading the month…" />;
  if (error) {
    return (
      <section aria-label="One month">
        <PageHeading title={`${MONTH_NAMES[month - 1]} ${year}`} />
        <Notice tone="error">
          {error instanceof ApiError ? error.message : "Could not load this month."}
        </Notice>
      </section>
    );
  }

  const rentTotal = monthRentTotal(data.cells);
  const billTotal = monthBillTotal(data.cells);

  return (
    <section aria-label="One month">
      <PageHeading
        title={`${MONTH_NAMES[month - 1]} ${year}`}
        subtitle={
          rentTotal === 0
            ? `No rent booked this month. Bills came to ${formatAmount(billTotal, currency)}.`
            : `${formatAmount(rentTotal, currency)} in, ${formatAmount(billTotal, currency)} out — ${formatAmount(rentTotal - billTotal, currency)} left over.`
        }
        actions={
          <>
            <label className="sr-only" htmlFor="month-picker">
              Pick a month
            </label>
            <Select
              id="month-picker"
              className="w-auto"
              value={month}
              onChange={(e) => router.push(`/month/${year}/${e.target.value}`)}
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </Select>
            <ButtonLink href="/">Back to the year</ButtonLink>
          </>
        }
      />

      {!editable ? (
        <div className="mb-5">
          <Notice tone="info">
            {canEdit
              ? `${year} is read-only. Unlock it from the year screen to change anything here.`
              : "This account can view the sheet but not change it."}
          </Notice>
        </div>
      ) : null}

      {setEntry.error ? (
        <div className="mb-5">
          <Notice tone="error">
            {setEntry.error instanceof ApiError
              ? setEntry.error.message
              : "That change did not save."}
          </Notice>
        </div>
      ) : null}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] items-start gap-6">
        <Card className="px-[22px] pt-[19px] pb-[21px]">
          <div className="mb-3.5 flex items-baseline gap-2.5">
            <h2 className="text-[17px] font-semibold">Bills</h2>
            <span className="num ml-auto text-[21px] font-semibold">
              {formatAmount(billTotal, currency)}
            </span>
          </div>
          <div className="flex flex-col gap-[11px]">
            {data.billTypes.length === 0 ? (
              <p className="text-[13px] text-muted-2">
                No bill types yet. Add one and it becomes a column on the sheet.
              </p>
            ) : (
              data.billTypes.map((bill) => (
                <EntryRow
                  key={bill.id}
                  label={bill.name}
                  cell={data.cells.bills[bill.id]}
                  placeholder="0"
                  editable={editable}
                  failed={failed === `bill:${bill.id}`}
                  onAmount={(amount) =>
                    setEntry.mutate(
                      { kind: "bill", targetId: bill.id, year, month, amount },
                      {
                        onError: () => setFailed(`bill:${bill.id}`),
                        onSuccess: () => setFailed(null),
                      },
                    )
                  }
                  onStatus={(status) =>
                    setEntry.mutate(
                      { kind: "bill", targetId: bill.id, year, month, status },
                      {
                        onError: () => setFailed(`bill:${bill.id}`),
                        onSuccess: () => setFailed(null),
                      },
                    )
                  }
                />
              ))
            )}
          </div>
        </Card>

        <Card className="px-[22px] pt-[19px] pb-[21px]">
          <div className="mb-3.5 flex items-baseline gap-2.5">
            <h2 className="text-[17px] font-semibold">Rent</h2>
            <span className="num ml-auto text-[21px] font-semibold">
              {formatAmount(rentTotal, currency)}
            </span>
          </div>
          <div className="flex flex-col gap-[11px]">
            {data.tenancies.length === 0 ? (
              <p className="text-[13px] text-muted-2">
                Nobody was renting this month. Assign a tenant to a unit and this fills in.
              </p>
            ) : (
              data.tenancies.map((tenancy) => {
                /* The server sends unitId; matching on tenant name instead made
                 * two tenants who share a name show each other's figures. */
                return (
                  <EntryRow
                    key={tenancy.id}
                    label={tenancy.unitLabel}
                    boldLabel
                    cell={data.cells.rent[tenancy.unitId] ?? { amount: 0, status: "upcoming" }}
                    placeholder={String(tenancy.expectedRent || 0)}
                    editable={editable}
                    failed={failed === `rent:${tenancy.id}`}
                    onAmount={(amount) =>
                      setEntry.mutate(
                        { kind: "rent", targetId: tenancy.id, year, month, amount },
                        {
                          onError: () => setFailed(`rent:${tenancy.id}`),
                          onSuccess: () => setFailed(null),
                        },
                      )
                    }
                    onStatus={(status) =>
                      setEntry.mutate(
                        { kind: "rent", targetId: tenancy.id, year, month, status },
                        {
                          onError: () => setFailed(`rent:${tenancy.id}`),
                          onSuccess: () => setFailed(null),
                        },
                      )
                    }
                  />
                );
              })
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6 flex flex-wrap items-center gap-[34px] px-6 py-5">
        <Total label="Rent this month" value={formatAmount(rentTotal, currency)} />
        <Total label="Bills this month" value={formatAmount(billTotal, currency)} />
        <Total label="Left over" value={formatAmount(rentTotal - billTotal, currency)} accent />
        <ButtonLink variant="primary" href="/" className="ml-auto">
          Done
        </ButtonLink>
      </Card>
    </section>
  );
}

function Total({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[12.5px] font-medium text-muted">{label}</div>
      <div
        className={cn(
          "num text-left text-[27px] font-semibold tracking-[-0.024em]",
          accent && "text-brand",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function EntryRow({
  label,
  cell,
  placeholder,
  editable,
  failed = false,
  boldLabel = false,
  onAmount,
  onStatus,
}: {
  label: string;
  cell: Cell;
  placeholder: string;
  editable: boolean;
  /** This row's last save was refused; its input still shows the unsaved value. */
  failed?: boolean;
  boldLabel?: boolean;
  onAmount: (amount: number) => void;
  onStatus: (status: "paid" | "upcoming") => void;
}) {
  const [draft, setDraft] = useState(cell.amount === 0 ? "" : String(cell.amount));

  return (
    <div className="flex items-center gap-[13px]">
      <span className={cn("w-[74px] shrink-0 text-sm", boldLabel ? "font-semibold" : "font-medium")}>
        {label}
      </span>
      <Field
        inputMode="numeric"
        aria-invalid={failed || undefined}
        className={cn("num min-w-0 flex-1", failed && "border-amber bg-amber-tint")}
        value={draft}
        placeholder={placeholder}
        disabled={!editable}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const amount = parseAmount(draft);
          if (amount !== cell.amount) onAmount(amount);
        }}
      />
      <StatusToggle
        value={cell.status}
        disabled={!editable}
        onChange={onStatus}
        label={label}
      />
    </div>
  );
}
