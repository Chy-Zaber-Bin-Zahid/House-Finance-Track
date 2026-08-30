import { and, asc, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { rentEntries, tenancies, tenants, units } from "@/db/schema";
import { NotFound, StillReferenced } from "./errors";
import { documentKeysFor, removeObjects } from "./files";
import { requireWritableYear } from "./guard";
import type { Actor } from "./session";
import { MONTH_NAMES } from "@/lib/seed";
import { BackwardsPeriod, fromPeriod, monthBefore, ordinal, toPeriod, type MonthRef } from "./period";

/**
 * Units, tenants, and the tenancies that join them. Kept separate on purpose:
 * a tenant outlives the unit they rented, and a unit outlives its tenants.
 */

/** Turns the database's refusal into something a person can act on. */
async function guardReferences<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const constraint = (error as { cause?: { constraint_name?: string } }).cause?.constraint_name;
    if (constraint) {
      /*
       * One message for every constraint told someone with a mistyped unit that
       * it "has money recorded" and to end the tenancy instead - advice that
       * does not unblock the delete, because the tenancy is the reference.
       */
      const blockedByTenancy = constraint.startsWith("tenancies_");
      throw new StillReferenced(
        blockedByTenancy
          ? `This ${what} still has a tenancy on it. Delete the tenancy first, or leave it — ended tenancies keep their history.`
          : `This ${what} has money recorded against it, so it cannot be deleted. End it instead — its history stays either way.`,
      );
    }
    throw error;
  }
}

export async function listUnits(db: Database) {
  return db.select().from(units).orderBy(asc(units.label));
}

export async function createUnit(db: Database, label: string, floor: string) {
  const [row] = await db
    .insert(units)
    .values({ label: label.trim(), floor: floor.trim() || "Not set" })
    .returning();
  return row;
}

export async function updateUnit(db: Database, id: number, patch: { label?: string; floor?: string }) {
  const [row] = await db.update(units).set(patch).where(eq(units.id, id)).returning();
  if (!row) throw new NotFound("No such unit.");
  return row;
}

export async function deleteUnit(db: Database, id: number) {
  await guardReferences("unit", async () => {
    const deleted = await db.delete(units).where(eq(units.id, id)).returning();
    if (deleted.length === 0) throw new NotFound("No such unit.");
  });
}

export async function listTenants(db: Database) {
  return db.select().from(tenants).orderBy(asc(tenants.name));
}

export async function createTenant(db: Database, name: string, phone = "", notes = "") {
  const [row] = await db
    .insert(tenants)
    .values({ name: name.trim(), phone: phone.trim(), notes })
    .returning();
  return row;
}

export async function updateTenant(
  db: Database,
  id: number,
  patch: { name?: string; phone?: string; notes?: string },
) {
  const [row] = await db.update(tenants).set(patch).where(eq(tenants.id, id)).returning();
  if (!row) throw new NotFound("No such tenant.");
  return row;
}

export async function deleteTenant(db: Database, id: number) {
  /*
   * Read the keys first. The delete below cascades the document rows away, and
   * once they are gone nothing in the database names the objects any more.
   */
  const keys = await documentKeysFor(db, id);

  await guardReferences("tenant", async () => {
    const deleted = await db.delete(tenants).where(eq(tenants.id, id)).returning();
    if (deleted.length === 0) throw new NotFound("No such tenant.");
  });

  /* Only once the tenant is actually gone: a tenant still holding a tenancy is
   * refused above, and their files must survive that refusal untouched. */
  await removeObjects(keys);
}

export type TenancyInput = {
  unitId: number;
  tenantId: number;
  start: MonthRef;
  end: MonthRef | null;
  expectedRent: number;
};

/**
 * Which years a period touches, so a write that moves one can be checked
 * against the year lock.
 *
 * The line this draws: changing *which months hold money, or whose they are*
 * is year-scoped and needs the year unlocked. Renaming a unit, a tenant, or a
 * bill type is not — an identity correction should apply everywhere, including
 * closed years, which is the point of it being one record rather than a copy
 * per year.
 */
function yearsTouched(start: MonthRef, end: MonthRef | null): number[] {
  const last = end ? end.year : start.year;
  const years: number[] = [];
  for (let year = start.year; year <= last; year += 1) years.push(year);
  return years;
}

export class OverlappingTenancy extends Error {
  constructor() {
    super("That unit already has a tenancy covering those months. End the current one first.");
    this.name = "OverlappingTenancy";
  }
}

export async function createTenancy(db: Database, input: TenancyInput, actor?: Actor) {
  /* Opening a tenancy decides which months a unit collects in — year-scoped. */
  if (actor) {
    for (const year of yearsTouched(input.start, input.end)) requireWritableYear(actor, year);
  }
  try {
    const [row] = await db
      .insert(tenancies)
      .values({
        unitId: input.unitId,
        tenantId: input.tenantId,
        period: toPeriod(input.start, input.end),
        expectedRent: input.expectedRent,
      })
      .returning();
    return row;
  } catch (error) {
    const cause = (error as { cause?: { constraint_name?: string } }).cause;
    if (cause?.constraint_name === "tenancies_no_overlapping_period") throw new OverlappingTenancy();
    throw error;
  }
}

/** Ending a tenancy leaves the tenant and every amount recorded under it intact. */
export async function endTenancy(db: Database, id: number, end: MonthRef, actor?: Actor) {
  const [existing] = await db.select().from(tenancies).where(eq(tenancies.id, id)).limit(1);
  if (!existing) throw new NotFound("No such tenancy.");

  const { start, end: previousEnd } = fromPeriod(existing.period);

  /*
   * Both the years it covered and the years it will cover: shortening a
   * tenancy blanks cells in the years it stops covering, which is a change to
   * those years even though the request never names them.
   */
  if (actor) {
    const affected = new Set([
      ...yearsTouched(start, previousEnd),
      ...yearsTouched(start, end),
    ]);
    for (const year of affected) requireWritableYear(actor, year);
  }

  /*
   * Rent recorded after the new end month would keep counting toward the year
   * total while no cell could show it - the sheet's columns would stop adding
   * up to the total printed beside them. Refuse rather than let money fall out
   * of view.
   */
  const recorded = await db.select().from(rentEntries).where(eq(rentEntries.tenancyId, id));
  const stranded = recorded.filter(
    (entry) => entry.amount > 0 && ordinal({ year: entry.year, month: entry.month }) > ordinal(end),
  );
  if (stranded.length > 0) {
    const months = stranded
      .map((e) => `${MONTH_NAMES[e.month - 1].slice(0, 3)} ${e.year}`)
      .join(", ");
    throw new StillReferenced(
      `This tenancy has rent recorded after that month (${months}). Clear those amounts first, or end it later.`,
    );
  }

  try {
    const [row] = await db
      .update(tenancies)
      .set({ period: toPeriod(start, end) })
      .where(eq(tenancies.id, id))
      .returning();
    return row;
  } catch (error) {
    const cause = (error as { cause?: { constraint_name?: string } }).cause;
    if (cause?.constraint_name === "tenancies_no_overlapping_period") throw new OverlappingTenancy();
    throw error;
  }
}

export class RentChangeOutsideTenancy extends Error {
  constructor() {
    super("That month is not one this tenancy covers.");
    this.name = "RentChangeOutsideTenancy";
  }
}

/**
 * Correct what a tenancy charges, leaving the months it covers alone.
 *
 * Not year-scoped, and deliberately so. `expectedRent` fills the placeholder on
 * the month screen and nothing else — no recorded amount reads from it — so
 * fixing a figure that was mistyped is the same kind of edit as fixing a
 * misspelled name: it should apply everywhere the tenancy is read, closed years
 * included. Use `changeRentFrom` when the rent genuinely changed from some
 * month on; this one reads as though the new figure always applied.
 */
export async function setExpectedRent(db: Database, id: number, expectedRent: number) {
  const [row] = await db
    .update(tenancies)
    .set({ expectedRent })
    .where(eq(tenancies.id, id))
    .returning();
  if (!row) throw new NotFound("No such tenancy.");
  return row;
}

/**
 * The rent changed from a given month — up or down, any month, as often as it
 * needs to.
 *
 * A tenancy charges one figure for as long as it runs, so a change is a second
 * tenancy rather than an edit: the old one is shortened to the month before,
 * and a new one takes the rest of the period at the new figure. Same unit, same
 * tenant, no gap between them, and the months already recorded keep the amounts
 * they were recorded with.
 *
 * Rent entered for the months that move goes with them. Those months belong to
 * the new tenancy now, and an amount left behind on the old one would still
 * count toward the year total with no cell able to show it — the same money
 * falling out of view that `endTenancy` refuses to allow.
 *
 * Changing from the start month is not a split at all: there is no earlier
 * stretch to keep, so it settles into a plain correction.
 */
export async function changeRentFrom(
  db: Database,
  id: number,
  from: MonthRef,
  expectedRent: number,
  actor?: Actor,
) {
  const [existing] = await db.select().from(tenancies).where(eq(tenancies.id, id)).limit(1);
  if (!existing) throw new NotFound("No such tenancy.");

  const { start, end } = fromPeriod(existing.period);
  if (end && ordinal(from) > ordinal(end)) throw new RentChangeOutsideTenancy();

  /* At or before the start there is nothing to split off — the new figure
   * applies to every month this tenancy has. */
  if (ordinal(from) <= ordinal(start)) {
    const row = await setExpectedRent(db, id, expectedRent);
    return { tenancy: row, split: false as const };
  }

  /* Which months belong to which tenancy is year-scoped, exactly as opening or
   * ending one is. Only the stretch from the change onward moves. */
  if (actor) {
    for (const year of yearsTouched(from, end)) requireWritableYear(actor, year);
  }

  return db.transaction(async (tx) => {
    /* Shorten first, then open the new one: the exclusion constraint sees no
     * overlap at any point, so it never has to be deferred. */
    await tx
      .update(tenancies)
      .set({ period: toPeriod(start, monthBefore(from)) })
      .where(eq(tenancies.id, id));

    const [created] = await tx
      .insert(tenancies)
      .values({
        unitId: existing.unitId,
        tenantId: existing.tenantId,
        period: toPeriod(from, end),
        expectedRent,
      })
      .returning();

    await tx
      .update(rentEntries)
      .set({ tenancyId: created.id })
      .where(
        and(
          eq(rentEntries.tenancyId, id),
          sql`${rentEntries.year} * 12 + ${rentEntries.month} >= ${ordinal(from)}`,
        ),
      );

    return { tenancy: created, split: true as const };
  });
}

export async function deleteTenancy(db: Database, id: number, actor?: Actor) {
  if (actor) {
    const [existing] = await db.select().from(tenancies).where(eq(tenancies.id, id)).limit(1);
    if (!existing) throw new NotFound("No such tenancy.");
    const { start, end } = fromPeriod(existing.period);
    for (const year of yearsTouched(start, end)) requireWritableYear(actor, year);
  }
  await guardReferences("tenancy", async () => {
    const deleted = await db.delete(tenancies).where(eq(tenancies.id, id)).returning();
    if (deleted.length === 0) throw new NotFound("No such tenancy.");
  });
}

export async function listTenancies(db: Database) {
  const rows = await db
    .select({
      id: tenancies.id,
      period: tenancies.period,
      expectedRent: tenancies.expectedRent,
      unitId: units.id,
      unitLabel: units.label,
      tenantId: tenants.id,
      tenantName: tenants.name,
    })
    .from(tenancies)
    .innerJoin(units, eq(units.id, tenancies.unitId))
    .innerJoin(tenants, eq(tenants.id, tenancies.tenantId))
    .orderBy(asc(units.label));

  return rows.map((r) => ({ ...r, ...fromPeriod(r.period) }));
}

/** Every tenancy a tenant has held, with what was collected under each. */
export async function tenantHistory(db: Database, tenantId: number) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw new NotFound("No such tenant.");

  const held = await db
    .select({
      id: tenancies.id,
      period: tenancies.period,
      expectedRent: tenancies.expectedRent,
      unitLabel: units.label,
    })
    .from(tenancies)
    .innerJoin(units, eq(units.id, tenancies.unitId))
    .where(eq(tenancies.tenantId, tenantId));

  const withRent = await Promise.all(
    held.map(async (tenancy) => {
      const rent = await db
        .select()
        .from(rentEntries)
        .where(eq(rentEntries.tenancyId, tenancy.id))
        .orderBy(asc(rentEntries.year), asc(rentEntries.month));
      return {
        ...tenancy,
        ...fromPeriod(tenancy.period),
        collected: rent.reduce((total, r) => total + r.amount, 0),
        entries: rent,
      };
    }),
  );

  return { tenant, tenancies: withRent };
}
