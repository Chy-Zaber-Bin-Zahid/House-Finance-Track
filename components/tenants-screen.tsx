"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useCreateTenant, useMe, useTenancies, useTenants } from "@/components/hooks";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { Button, Card, Empty, Field, Label, Loading, Notice, PageHeading } from "@/components/ui";
import { cn } from "@/lib/cn";
import { countLabel, initialsOf } from "@/lib/format";
import { ApiError } from "@/lib/api";

const th =
  "border-b border-line-9 px-[11px] py-[9px] text-left text-[11.5px] font-medium text-muted whitespace-nowrap";
const td = "p-[11px] text-sm";

/**
 * The people, on their own page.
 *
 * Units and tenants used to share one screen, which read as a single thing with
 * two tables rather than two registers that happen to meet at a tenancy. The
 * letting itself — who is in which unit, at what rent — stays on the units page,
 * because that is where a unit's current state belongs.
 */
export function TenantsScreen() {
  const tenants = useTenants();
  const tenancies = useTenancies();
  const { data: me } = useMe();
  const canEdit = me?.actor?.role === "owner" || me?.actor?.role === "super_admin";

  const [formOpen, setFormOpen] = useState(false);

  if (tenants.isPending || tenancies.isPending) return <Loading label="Loading tenants…" />;

  const error = tenants.error ?? tenancies.error;
  if (error) {
    return (
      <section aria-label="Tenants">
        <PageHeading title="Tenants" />
        <Notice tone="error">
          {error instanceof ApiError ? error.message : "Could not load this screen."}
        </Notice>
      </section>
    );
  }

  const tenantList = tenants.data?.tenants ?? [];
  const held = tenancies.data?.tenancies ?? [];

  return (
    <section aria-label="Tenants">
      <PageHeading
        title="Tenants"
        subtitle={`${countLabel(tenantList.length, "tenant", "tenants")} on file`}
        actions={
          canEdit ? (
            <Button variant="primary" onClick={() => setFormOpen((v) => !v)}>
              <PlusIcon className="size-3.5" />
              Add a tenant
            </Button>
          ) : null
        }
      />

      {formOpen ? <AddTenantForm onClose={() => setFormOpen(false)} /> : null}

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
                        <Link
                          href={`/tenants/${tenant.id}`}
                          className="inline-flex items-center gap-[11px] text-ink hover:text-brand"
                        >
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
            <Field
              id="tenant-name"
              value={name}
              placeholder="Anwar Hossain"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="w-[180px]">
            <Label htmlFor="tenant-phone">Phone</Label>
            <Field
              id="tenant-phone"
              value={phone}
              placeholder="01711 204 866"
              onChange={(e) => setPhone(e.target.value)}
            />
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
