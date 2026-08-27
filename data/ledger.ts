import { and, asc, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { billEntries, billTypes, rentEntries, tenancies, tenants, units } from "@/db/schema";
import { NotFound, StillReferenced } from "./errors";
import { covers, fromPeriod } from "./period";

export type EntryStatus = "paid" | "upcoming";

/* ------------------------------- bill types ------------------------------ */

export async function listBillTypes(db: Database, includeRetired = true) {
  const rows = await db.select().from(billTypes).orderBy(asc(billTypes.id));
  return includeRetired ? rows : rows.filter((b) => b.active);
}

export async function createBillType(db: Database, name: string) {
  const [row] = await db.insert(billTypes).values({ name: name.trim() }).returning();
  return row;
}

export async function renameBillType(db: Database, id: number, name: string) {
  const [row] = await db.update(billTypes).set({ name: name.trim() }).where(eq(billTypes.id, id)).returning();
  if (!row) throw new NotFound("No such bill type.");
  return row;
}

/** Retiring hides a type from future months and leaves the ones it already has. */
export async function setBillTypeActive(db: Database, id: number, active: boolean) {
  const [row] = await db.update(billTypes).set({ active }).where(eq(billTypes.id, id)).returning();
  if (!row) throw new NotFound("No such bill type.");
  return row;
}

export async function deleteBillType(db: Database, id: number) {
  try {
    const deleted = await db.delete(billTypes).where(eq(billTypes.id, id)).returning();
    if (deleted.length === 0) throw new NotFound("No such bill type.");
  } catch (error) {
    if (error instanceof NotFound) throw error;
    const cause = (error as { cause?: { constraint_name?: string } }).cause;
    if (cause?.constraint_name) {
      throw new StillReferenced(
        "This bill type has amounts recorded against it, so it cannot be deleted. Retire it instead — old months keep showing it.",
      );
    }
    throw error;
  }
}

/* --------------------------------- money --------------------------------- */

export async function setRentAmount(
  db: Database,
  tenancyId: number,
  year: number,
  month: number,
  patch: { amount?: number; status?: EntryStatus },
) {
  const [row] = await db
    .insert(rentEntries)
    .values({
      tenancyId,
      year,
      month,
      amount: patch.amount ?? 0,
      status: patch.status ?? "upcoming",
    })
    .onConflictDoUpdate({
      target: [rentEntries.tenancyId, rentEntries.year, rentEntries.month],
      set: {
        ...(patch.amount === undefined ? {} : { amount: patch.amount }),
        ...(patch.status === undefined ? {} : { status: patch.status }),
      },
    })
    .returning();
  return row;
}

export async function setBillAmount(
  db: Database,
  billTypeId: number,
  year: number,
  month: number,
  patch: { amount?: number; status?: EntryStatus },
) {
  const [row] = await db
    .insert(billEntries)
    .values({
      billTypeId,
      year,
      month,
      amount: patch.amount ?? 0,
      status: patch.status ?? "upcoming",
    })
    .onConflictDoUpdate({
      target: [billEntries.billTypeId, billEntries.year, billEntries.month],
      set: {
        ...(patch.amount === undefined ? {} : { amount: patch.amount }),
        ...(patch.status === undefined ? {} : { status: patch.status }),
      },
    })
    .returning();
  return row;
}

/* --------------------------------- views --------------------------------- */

/** Which bill types a year shows: active ones, plus retired ones that carry amounts. */
export async function billTypesForYear(db: Database, year: number) {
  const all = await listBillTypes(db);
  const used = await db
    .selectDistinct({ id: billEntries.billTypeId })
    .from(billEntries)
    .where(eq(billEntries.year, year));
  const usedIds = new Set(used.map((u) => u.id));
  return all.filter((type) => type.active || usedIds.has(type.id));
}

/** Which tenancies were running in a given month — a unit with none records nothing. */
export async function tenanciesForMonth(db: Database, year: number, month: number) {
  const rows = await db
    .select({
      id: tenancies.id,
      period: tenancies.period,
      expectedRent: tenancies.expectedRent,
      unitId: units.id,
      unitLabel: units.label,
      tenantName: tenants.name,
    })
    .from(tenancies)
    .innerJoin(units, eq(units.id, tenancies.unitId))
    .innerJoin(tenants, eq(tenants.id, tenancies.tenantId))
    .orderBy(asc(units.label));

  return rows.filter((r) => covers(r.period, year, month));
}

export type SheetCell = { amount: number; status: EntryStatus };

/** The whole year, in the shape the sheet reads. */
export async function yearSheet(db: Database, year: number) {
  const types = await billTypesForYear(db, year);
  const allUnits = await db.select().from(units).orderBy(asc(units.label));

  const held = await db
    .select({
      id: tenancies.id,
      period: tenancies.period,
      unitId: tenancies.unitId,
      tenantId: tenancies.tenantId,
      tenantName: tenants.name,
    })
    .from(tenancies)
    .innerJoin(tenants, eq(tenants.id, tenancies.tenantId));

  const rent = await db.select().from(rentEntries).where(eq(rentEntries.year, year));
  const bills = await db.select().from(billEntries).where(eq(billEntries.year, year));

  const tenancyById = new Map(held.map((t) => [t.id, t]));

  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;

    const billCells: Record<number, SheetCell> = {};
    for (const type of types) {
      const found = bills.find((b) => b.billTypeId === type.id && b.month === month);
      billCells[type.id] = { amount: found?.amount ?? 0, status: found?.status ?? "upcoming" };
    }

    const rentCells: Record<number, SheetCell & { tenantName: string | null }> = {};
    for (const unit of allUnits) {
      const running = held.find((t) => t.unitId === unit.id && covers(t.period, year, month));
      const found = running
        ? rent.find((r) => r.tenancyId === running.id && r.month === month)
        : undefined;
      rentCells[unit.id] = {
        amount: found?.amount ?? 0,
        status: found?.status ?? "upcoming",
        tenantName: running?.tenantName ?? null,
      };
    }

    return { month, bills: billCells, rent: rentCells };
  });

  return {
    year,
    billTypes: types,
    units: allUnits,
    months,
    handovers: allUnits
      .map((unit) => ({
        unitId: unit.id,
        tenancies: held
          .filter((t) => t.unitId === unit.id)
          .map((t) => ({ tenantName: t.tenantName, ...fromPeriod(t.period) })),
      }))
      .filter((h) => h.tenancies.length > 1),
    tenancyById: Object.fromEntries(tenancyById),
  };
}

export async function yearTotals(db: Database, year: number) {
  const [rent] = await db
    .select({ total: sql<number>`coalesce(sum(${rentEntries.amount}), 0)::int` })
    .from(rentEntries)
    .where(eq(rentEntries.year, year));
  const [bill] = await db
    .select({ total: sql<number>`coalesce(sum(${billEntries.amount}), 0)::int` })
    .from(billEntries)
    .where(eq(billEntries.year, year));
  return { rent: rent.total, bills: bill.total, kept: rent.total - bill.total };
}

/** Which years hold any data, so the app can offer them. */
export async function yearsWithData(db: Database): Promise<number[]> {
  const rent = await db.selectDistinct({ year: rentEntries.year }).from(rentEntries);
  const bills = await db.selectDistinct({ year: billEntries.year }).from(billEntries);
  return [...new Set([...rent, ...bills].map((r) => r.year))].sort((a, b) => b - a);
}

export async function monthTotals(db: Database, year: number, month: number) {
  const [rent] = await db
    .select({ total: sql<number>`coalesce(sum(${rentEntries.amount}), 0)::int` })
    .from(rentEntries)
    .where(and(eq(rentEntries.year, year), eq(rentEntries.month, month)));
  const [bill] = await db
    .select({ total: sql<number>`coalesce(sum(${billEntries.amount}), 0)::int` })
    .from(billEntries)
    .where(and(eq(billEntries.year, year), eq(billEntries.month, month)));
  return { rent: rent.total, bills: bill.total, kept: rent.total - bill.total };
}
