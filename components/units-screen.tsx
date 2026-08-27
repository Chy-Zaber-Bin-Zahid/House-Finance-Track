"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AddUnitForm } from "@/components/add-unit-form";
import {
  useCreateTenancy,
  useCreateTenant,
  useEndTenancy,
  useMe,
  useTenancies,
  useTenants,
  useUnits,
} from "@/components/hooks";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { Button, Card, Empty, Field, Label, Loading, Notice, PageHeading, Pill, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import { HOUSE_CONFIG } from "@/lib/config";
import { countLabel, formatAmount, initialsOf, parseAmount } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/seed";
import { ApiError, type MonthRef } from "@/lib/api";

const th =
  "border-b border-line-9 px-[11px] py-[9px] text-left text-[11.5px] font-medium text-muted whitespace-nowrap";
const td = "p-[11px] text-sm";

const monthLabel = (m: MonthRef) => `${MONTH_NAMES[m.month - 1].slice(0, 3)} ${m.year}`;

export function UnitsScreen() {
  const units = useUnits();
  const tenants = useTenants();
  const tenancies = useTenancies();
  const { data: me } = useMe();
  const canEdit = me?.actor?.role === "owner" || me?.actor?.role === "super_admin";

  const [unitFormOpen, setUnitFormOpen] = useState(false);
  const [tenantFormOpen, setTenantFormOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  if (units.isPending || tenants.isPending || tenancies.isPending) {
    return <Loading label="Loading units and tenants…" />;
  }

  const error = units.error ?? tenants.error ?? tenancies.error;
  if (error) {
    return (
      <section aria-label="Units and tenants">
        <PageHeading title="Units and tenants" />
        <Notice tone="error">
          {error instanceof ApiError ? error.message : "Could not load this screen."}
        </Notice>
      </section>
    );
  }

  /* Narrowed once here; TypeScript cannot carry it across three query results. */
  const unitList = units.data?.units ?? [];
  const tenantList = tenants.data?.tenants ?? [];
  const held = tenancies.data?.tenancies ?? [];
  const openFor = (unitId: number) => held.find((t) => t.unitId === unitId && t.end === null);

  return (
    <section aria-label="Units and tenants">
      <PageHeading
        title="Units and tenants"
        subtitle={`${countLabel(unitList.length, "unit", "units")} · ${countLabel(
          tenantList.length,
          "tenant",
          "tenants",
        )} on file`}
        actions={
          canEdit ? (
            <>
              <Button onClick={() => setTenantFormOpen((v) => !v)}>
                <PlusIcon className="size-3.5" />
                Add a tenant
              </Button>
              <Button onClick={() => setUnitFormOpen((v) => !v)}>
                <PlusIcon className="size-3.5" />
                Add a unit
              </Button>
              <Button variant="primary" onClick={() => setAssignOpen((v) => !v)}>
                Assign a tenant
              </Button>
            </>
          ) : null
        }
      />

      {unitFormOpen ? <AddUnitForm onClose={() => setUnitFormOpen(false)} /> : null}
      {tenantFormOpen ? <AddTenantForm onClose={() => setTenantFormOpen(false)} /> : null}
      {assignOpen ? (
        <AssignForm
          units={unitList}
          tenants={tenantList}
          onClose={() => setAssignOpen(false)}
        />
      ) : null}

      <h2 className="mb-3 text-[15px] font-semibold">Units</h2>
      <Card className="mb-8 overflow-hidden p-0">
        {unitList.length === 0 ? (
          <Empty>No units yet. A unit is the room; add one and then assign a tenant to it.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={cn(th, "w-[110px] pl-5")}>Unit</th>
                  <th scope="col" className={cn(th, "min-w-[160px]")}>Where it is</th>
                  <th scope="col" className={cn(th, "w-[220px]")}>Tenant now</th>
                  <th scope="col" className={cn(th, "w-[150px] text-right")}>Monthly rent</th>
                  <th scope="col" className={cn(th, "w-[130px]")}>Since</th>
                </tr>
              </thead>
              <tbody>
                {unitList.map((unit, i) => {
                  const current = openFor(unit.id);
                  return (
                    <tr
                      key={unit.id}
                      className={cn(i < unitList.length - 1 && "border-b border-line-5")}
                    >
                      <th scope="row" className={cn(td, "pl-5 text-left font-semibold")}>
                        {unit.label}
                      </th>
                      <td className={cn(td, "text-muted")}>{unit.floor}</td>
                      <td className={td}>
                        {current ? (
                          <Link
                            href={`/units/${current.tenantId}`}
                            className="inline-flex items-center gap-[11px] text-ink hover:text-brand"
                          >
                            <span
                              aria-hidden="true"
                              className="grid size-[30px] shrink-0 place-items-center rounded-full bg-avatar text-[11.5px] font-semibold text-slate"
                            >
                              {initialsOf(current.tenantName)}
                            </span>
                            {current.tenantName}
                          </Link>
                        ) : (
                          <Pill className="bg-chip text-slate">Empty</Pill>
                        )}
                      </td>
                      <td className={cn(td, "num text-right")}>
                        {current ? formatAmount(current.expectedRent, HOUSE_CONFIG.currency) : "—"}
                      </td>
                      <td className={cn(td, "text-[13px] text-muted")}>
                        {current ? monthLabel(current.start) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <h2 className="mb-3 text-[15px] font-semibold">Tenants</h2>
      <Card className="overflow-hidden p-0">
        {tenantList.length === 0 ? (
          <Empty>No tenants on file yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={cn(th, "pl-5")}>Tenant</th>
                  <th scope="col" className={cn(th, "w-[170px]")}>Phone</th>
                  <th scope="col" className={cn(th, "w-[200px]")}>Renting now</th>
                  <th scope="col" className={cn(th, "w-10 pr-5")}>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tenantList.map((tenant, i) => {
                  const current = held.find((t) => t.tenantId === tenant.id && t.end === null);
                  return (
                    <tr
                      key={tenant.id}
                      className={cn(
                        "transition-colors hover:bg-hover-row",
                        i < tenantList.length - 1 && "border-b border-line-5",
                      )}
                    >
                      <th scope="row" className={cn(td, "pl-5 text-left font-medium")}>
                        <Link href={`/units/${tenant.id}`} className="inline-flex items-center gap-[11px] text-ink hover:text-brand">
                          <span
                            aria-hidden="true"
                            className="grid size-[30px] shrink-0 place-items-center rounded-full bg-avatar text-[11.5px] font-semibold text-slate"
                          >
                            {initialsOf(tenant.name)}
                          </span>
                          {tenant.name}
                        </Link>
                      </th>
                      <td className={cn(td, "text-muted")}>{tenant.phone || "—"}</td>
                      <td className={td}>
                        {current ? (
                          <span className="font-medium">{current.unitLabel}</span>
                        ) : (
                          <span className="text-muted">Not renting</span>
                        )}
                      </td>
                      <td className={cn(td, "pr-5 text-right text-chevron")}>
                        <ChevronRightIcon className="ml-auto size-[15px]" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {held.some((t) => t.end !== null) ? (
        <>
          <h2 className="mt-8 mb-3 text-[15px] font-semibold">Past tenancies</h2>
          <Card className="overflow-hidden p-0">
            <table className="w-full border-collapse">
              <tbody>
                {held
                  .filter((t) => t.end !== null)
                  .map((t, i, all) => (
                    <tr key={t.id} className={cn(i < all.length - 1 && "border-b border-line-5")}>
                      <td className={cn(td, "pl-5 font-medium")}>{t.unitLabel}</td>
                      <td className={td}>{t.tenantName}</td>
                      <td className={cn(td, "pr-5 text-right text-[13px] text-muted")}>
                        {monthLabel(t.start)} – {monthLabel(t.end!)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : null}

      {canEdit && held.some((t) => t.end === null) ? (
        <EndTenancyPanel tenancies={held.filter((t) => t.end === null)} />
      ) : null}
    </section>
  );
}

function AddTenantForm({ onClose }: { onClose: () => void }) {
  const create = useCreateTenant();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() === "") return;
    try {
      await create.mutateAsync({ name, phone });
      setName("");
      setPhone("");
      onClose();
    } catch {
      /* Shown below. */
    }
  }

  return (
    <Card className="mb-6 border-brand/30 bg-white px-[19px] pt-[17px] pb-[19px]">
      <form onSubmit={submit}>
        <h2 className="mb-3.5 text-[15px] font-semibold">Add a tenant</h2>
        <div className="flex flex-wrap items-end gap-[13px]">
          <div className="w-[220px]">
            <Label htmlFor="tenant-name">Name</Label>
            <Field id="tenant-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="w-[180px]">
            <Label htmlFor="tenant-phone">Phone</Label>
            <Field id="tenant-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button type="submit" variant="primary" disabled={name.trim() === "" || create.isPending}>
            {create.isPending ? "Adding…" : "Add the tenant"}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
        {create.error ? (
          <div className="mt-3">
            <Notice tone="error">
              {create.error instanceof ApiError ? create.error.message : "Could not add that tenant."}
            </Notice>
          </div>
        ) : null}
        <p className="mt-3 text-[13px] text-muted">
          A tenant exists on their own. They keep their record after they move out.
        </p>
      </form>
    </Card>
  );
}

function AssignForm({
  units,
  tenants,
  onClose,
}: {
  units: { id: number; label: string }[];
  tenants: { id: number; name: string }[];
  onClose: () => void;
}) {
  const create = useCreateTenancy();
  const now = new Date();
  const [unitId, setUnitId] = useState(units[0]?.id ?? 0);
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? 0);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rent, setRent] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await create.mutateAsync({
        unitId,
        tenantId,
        start: { year, month },
        end: null,
        expectedRent: parseAmount(rent),
      });
      onClose();
    } catch {
      /* Shown below. */
    }
  }

  if (units.length === 0 || tenants.length === 0) {
    return (
      <div className="mb-6">
        <Notice tone="info">
          Assigning needs at least one unit and one tenant. Add both first.
        </Notice>
      </div>
    );
  }

  return (
    <Card className="mb-6 border-brand/30 bg-white px-[19px] pt-[17px] pb-[19px]">
      <form onSubmit={submit}>
        <h2 className="mb-3.5 text-[15px] font-semibold">Assign a tenant to a unit</h2>
        <div className="flex flex-wrap items-end gap-[13px]">
          <div className="w-[150px]">
            <Label htmlFor="assign-unit">Unit</Label>
            <Select id="assign-unit" value={unitId} onChange={(e) => setUnitId(Number(e.target.value))}>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-[200px]">
            <Label htmlFor="assign-tenant">Tenant</Label>
            <Select id="assign-tenant" value={tenantId} onChange={(e) => setTenantId(Number(e.target.value))}>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-[140px]">
            <Label htmlFor="assign-month">From</Label>
            <Select id="assign-month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-[100px]">
            <Label htmlFor="assign-year">Year</Label>
            <Field
              id="assign-year"
              className="num"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || year)}
            />
          </div>
          <div className="w-[140px]">
            <Label htmlFor="assign-rent">Monthly rent</Label>
            <Field id="assign-rent" className="num" value={rent} placeholder="6000" onChange={(e) => setRent(e.target.value)} />
          </div>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Assigning…" : "Assign"}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
        {create.error ? (
          <div className="mt-3">
            <Notice tone="error">
              {create.error instanceof ApiError ? create.error.message : "Could not assign that tenant."}
            </Notice>
          </div>
        ) : null}
      </form>
    </Card>
  );
}

function EndTenancyPanel({
  tenancies,
}: {
  tenancies: { id: number; unitLabel: string; tenantName: string }[];
}) {
  const end = useEndTenancy();
  const now = new Date();
  const [id, setId] = useState(tenancies[0]?.id ?? 0);
  /* After a successful end the list shrinks under this state, and a stale id
   * would send the next click at an already-ended tenancy. */
  const selected = tenancies.some((t) => t.id === id) ? id : (tenancies[0]?.id ?? 0);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  return (
    <Card className="mt-8 px-[22px] pt-[19px] pb-[21px]">
      <h2 className="mb-1 text-[15px] font-semibold">Someone moved out</h2>
      <p className="mb-3.5 text-[13px] text-muted">
        Ending a tenancy keeps every amount recorded under it. The unit is then free for someone
        else from the following month.
      </p>
      <div className="flex flex-wrap items-end gap-[13px]">
        <div className="w-[260px]">
          <Label htmlFor="end-tenancy">Tenancy</Label>
          <Select id="end-tenancy" value={selected} onChange={(e) => setId(Number(e.target.value))}>
            {tenancies.map((t) => (
              <option key={t.id} value={t.id}>
                {t.unitLabel} — {t.tenantName}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-[140px]">
          <Label htmlFor="end-month">Last month</Label>
          <Select id="end-month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-[100px]">
          <Label htmlFor="end-year">Year</Label>
          <Field id="end-year" className="num" value={year} onChange={(e) => setYear(Number(e.target.value) || year)} />
        </div>
        <Button
          variant="primary"
          disabled={end.isPending || selected === 0}
          onClick={() => end.mutate({ id: selected, end: { year, month } })}
        >
          {end.isPending ? "Ending…" : "End the tenancy"}
        </Button>
      </div>
      {end.error ? (
        <div className="mt-3">
          <Notice tone="error">
            {end.error instanceof ApiError ? end.error.message : "Could not end that tenancy."}
          </Notice>
        </div>
      ) : null}
    </Card>
  );
}
