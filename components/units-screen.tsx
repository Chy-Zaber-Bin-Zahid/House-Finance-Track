"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AddUnitForm } from "@/components/add-unit-form";
import {
  useChangeRent,
  useCorrectRent,
  useCreateTenancy,
  useEndTenancy,
  useMe,
  useTenancies,
  useTenants,
  useUnits,
} from "@/components/hooks";
import { PlusIcon } from "@/components/icons";
import { Button, Card, Empty, Field, Label, Loading, Notice, PageHeading, Pill, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import { HOUSE_CONFIG } from "@/lib/config";
import { countLabel, formatAmount, initialsOf, parseAmount } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/seed";
import { ordinal } from "@/data/period";
import { ApiError, type MonthRef, type Tenancy } from "@/lib/api";

const th =
  "border-b border-line-9 px-[11px] py-[9px] text-left text-[11.5px] font-medium text-muted whitespace-nowrap";
const td = "p-[11px] text-sm";

const monthLabel = (m: MonthRef) => `${MONTH_NAMES[m.month - 1].slice(0, 3)} ${m.year}`;

/**
 * Whether a closed tenancy is someone actually leaving.
 *
 * A rent change closes one tenancy and opens the next on the following month,
 * same unit, same tenant. That record ended; the person did not. Counting it as
 * a departure would announce a move-out under "past tenancies" every time the
 * rent moved, which is the opposite of what happened.
 */
/**
 * When the tenant actually moved in: the start of the unbroken run of tenancies
 * leading up to this one, rather than the stretch the last rent change opened.
 * Each step walks strictly earlier, so the run always terminates.
 */
function movedIn(tenancy: Tenancy, all: Tenancy[]): MonthRef {
  let earliest = tenancy;
  for (;;) {
    const previous = all.find(
      (other) =>
        other.unitId === earliest.unitId &&
        other.tenantId === earliest.tenantId &&
        other.end !== null &&
        ordinal(other.end) + 1 === ordinal(earliest.start),
    );
    if (!previous) return earliest.start;
    earliest = previous;
  }
}

function movedOut(tenancy: Tenancy, all: Tenancy[]): boolean {
  if (tenancy.end === null) return false;
  const nextMonth = ordinal(tenancy.end) + 1;
  return !all.some(
    (other) =>
      other.id !== tenancy.id &&
      other.unitId === tenancy.unitId &&
      other.tenantId === tenancy.tenantId &&
      ordinal(other.start) === nextMonth,
  );
}

export function UnitsScreen() {
  const units = useUnits();
  const tenants = useTenants();
  const tenancies = useTenancies();
  const { data: me } = useMe();
  const canEdit = me?.actor?.role === "owner" || me?.actor?.role === "super_admin";

  const [unitFormOpen, setUnitFormOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  if (units.isPending || tenants.isPending || tenancies.isPending) {
    return <Loading label="Loading units…" />;
  }

  const error = units.error ?? tenants.error ?? tenancies.error;
  if (error) {
    return (
      <section aria-label="Units">
        <PageHeading title="Units" />
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
    <section aria-label="Units">
      <PageHeading
        title="Units"
        subtitle={`${countLabel(unitList.length, "unit", "units")} · ${countLabel(
          held.filter((t) => t.end === null).length,
          "let",
          "let",
        )} right now`}
        actions={
          canEdit ? (
            <>
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
      {assignOpen ? (
        <AssignForm
          units={unitList}
          tenants={tenantList}
          onClose={() => setAssignOpen(false)}
        />
      ) : null}

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
                            href={`/tenants/${current.tenantId}`}
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
                        {current ? monthLabel(movedIn(current, held)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {held.some((t) => movedOut(t, held)) ? (
        <>
          <h2 className="mt-8 mb-3 text-[15px] font-semibold">Past tenancies</h2>
          <Card className="overflow-hidden p-0">
            <table className="w-full border-collapse">
              <tbody>
                {held
                  .filter((t) => movedOut(t, held))
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

      {canEdit && held.length > 0 ? <ChangeRentPanel tenancies={held} /> : null}

      {canEdit && held.some((t) => t.end === null) ? (
        <EndTenancyPanel tenancies={held.filter((t) => t.end === null)} />
      ) : null}
    </section>
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

/**
 * Rent is not fixed: it can go up or down, in any month, as often as it needs
 * to. Two things a person could mean by changing it, kept apart because they
 * do different things to the history:
 *
 * - *from a month on* splits the tenancy, so the months before keep the old
 *   figure and the sheet still shows what was actually agreed back then;
 * - *every month* rewrites the one tenancy, for a figure that was mistyped
 *   when it was set and never applied.
 */
function ChangeRentPanel({ tenancies }: { tenancies: Tenancy[] }) {
  const change = useChangeRent();
  const correct = useCorrectRent();
  const now = new Date();
  const [id, setId] = useState(tenancies[0]?.id ?? 0);
  const [scope, setScope] = useState<"from" | "all">("from");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rent, setRent] = useState("");

  /* A split replaces the selected tenancy with two, so an id held across the
   * change would point at a row the list no longer offers. */
  const selected = tenancies.some((t) => t.id === id) ? id : (tenancies[0]?.id ?? 0);
  const current = tenancies.find((t) => t.id === selected);
  const pending = change.isPending || correct.isPending;
  const error = change.error ?? correct.error;

  function submit() {
    const expectedRent = parseAmount(rent);
    if (scope === "all") {
      correct.mutate({ id: selected, expectedRent }, { onSuccess: () => setRent("") });
    } else {
      change.mutate({ id: selected, from: { year, month }, expectedRent }, { onSuccess: () => setRent("") });
    }
  }

  return (
    <Card className="mt-8 px-[22px] pt-[19px] pb-[21px]">
      <h2 className="mb-1 text-[15px] font-semibold">The rent changed</h2>
      <p className="mb-3.5 text-[13px] text-muted">
        Up or down, from whichever month it took effect. The months before it keep the figure they
        were let at, and every amount already recorded stays as it was recorded.
      </p>
      <div className="flex flex-wrap items-end gap-[13px]">
        <div className="w-[300px]">
          <Label htmlFor="rent-tenancy">Tenancy</Label>
          <Select id="rent-tenancy" value={selected} onChange={(e) => setId(Number(e.target.value))}>
            {tenancies.map((t) => (
              <option key={t.id} value={t.id}>
                {t.unitLabel} — {t.tenantName} ({monthLabel(t.start)} –{" "}
                {t.end ? monthLabel(t.end) : "now"})
              </option>
            ))}
          </Select>
        </div>
        <div className="w-[190px]">
          <Label htmlFor="rent-scope">Applies to</Label>
          <Select
            id="rent-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as "from" | "all")}
          >
            <option value="from">From a month on</option>
            <option value="all">Every month (correction)</option>
          </Select>
        </div>
        {scope === "from" ? (
          <>
            <div className="w-[140px]">
              <Label htmlFor="rent-month">From</Label>
              <Select id="rent-month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-[100px]">
              <Label htmlFor="rent-year">Year</Label>
              <Field
                id="rent-year"
                className="num"
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || year)}
              />
            </div>
          </>
        ) : null}
        <div className="w-[140px]">
          <Label htmlFor="rent-amount">New rent</Label>
          <Field
            id="rent-amount"
            className="num"
            value={rent}
            placeholder={String(current?.expectedRent ?? 0)}
            onChange={(e) => setRent(e.target.value)}
          />
        </div>
        <Button variant="primary" disabled={pending || selected === 0 || rent.trim() === ""} onClick={submit}>
          {pending ? "Saving…" : "Change the rent"}
        </Button>
      </div>
      {current ? (
        <p className="mt-3 text-[13px] text-muted">
          {scope === "from"
            ? `${current.unitLabel} is on ${formatAmount(current.expectedRent, HOUSE_CONFIG.currency)} a month. Everything from ${monthLabel({ year, month })} onward moves to the new figure.`
            : `Corrects ${current.unitLabel} across ${monthLabel(current.start)} – ${current.end ? monthLabel(current.end) : "now"}, as though the new figure always applied.`}
        </p>
      ) : null}
      {error ? (
        <div className="mt-3">
          <Notice tone="error">
            {error instanceof ApiError ? error.message : "Could not change that rent."}
          </Notice>
        </div>
      ) : null}
    </Card>
  );
}
