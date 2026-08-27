import { BILL_KINDS, createInitialState } from "@/lib/seed";
import { connect } from "./connect";
import { billEntries, billTypes, rentEntries, tenancies, tenants, units } from "./schema";
import type { Database } from "./client";

/** The year the existing sheet holds. */
export const SEED_YEAR = 2026;

/**
 * The old model fused the room and the person into one record and carried no
 * dates at all, so the seed has to place each tenancy in time rather than just
 * reshape the data.
 *
 * Every tenancy is opened on 1 January of the seed year and left open-ended.
 * The old sheet recorded a zero for months a unit collected nothing, without
 * saying whether the tenant was absent or simply owed nothing — inventing a
 * later start date would assert an occupancy fact the source does not contain,
 * and would silently drop those zero rows. Correct any start date on the units
 * screen once the app is running.
 */
function periodFrom(year: number): string {
  return `[${year}-01-01,)`;
}

export async function seed(db: Database): Promise<void> {
  /*
   * Units and tenants carry no unique constraint, so a second run would insert
   * a whole duplicate ledger before failing on the bill-type name - doubling
   * every figure and leaving no rollback behind it.
   */
  const already = await db.select({ id: units.id }).from(units).limit(1);
  if (already.length > 0) {
    throw new Error(
      "This database already holds units. Seeding again would duplicate the ledger; truncate first if that is what you want.",
    );
  }

  const state = createInitialState();

  const insertedUnits = await db
    .insert(units)
    .values(state.units.map((u) => ({ label: u.label, floor: u.floor })))
    .returning();

  const insertedTenants = await db
    .insert(tenants)
    .values(
      state.units.map((u) => ({ name: u.name, phone: u.phone, notes: u.notes })),
    )
    .returning();

  const insertedTenancies = await db
    .insert(tenancies)
    .values(
      state.units.map((u, i) => ({
        unitId: insertedUnits[i].id,
        tenantId: insertedTenants[i].id,
        period: periodFrom(SEED_YEAR),
        expectedRent: u.expected,
      })),
    )
    .returning();

  await db.insert(rentEntries).values(
    state.units.flatMap((u, i) =>
      u.rent.map((entry, month) => ({
        tenancyId: insertedTenancies[i].id,
        year: SEED_YEAR,
        month: month + 1,
        amount: entry.amount,
        status: entry.status === "Paid" ? ("paid" as const) : ("upcoming" as const),
      })),
    ),
  );

  const insertedBillTypes = await db
    .insert(billTypes)
    .values(BILL_KINDS.map((b) => ({ name: b.label })))
    .returning();

  await db.insert(billEntries).values(
    state.bills.flatMap((row, month) =>
      row.map((entry, kind) => ({
        billTypeId: insertedBillTypes[kind].id,
        year: SEED_YEAR,
        month: month + 1,
        amount: entry.amount,
        status: entry.status === "Paid" ? ("paid" as const) : ("upcoming" as const),
      })),
    ),
  );
}

/** Runnable as a script: `npx tsx db/seed.ts` or via the db:seed npm script. */
if (process.argv[1]?.endsWith("seed.ts")) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const { db, close } = connect(url);
  seed(db as unknown as Database)
    .then(() => console.log(`Seeded ${SEED_YEAR}.`))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(close);
}
