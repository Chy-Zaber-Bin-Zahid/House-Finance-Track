import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { expectRejection, testDb, truncateAll } from "@/test/db";
import { seed, SEED_YEAR } from "./seed";
import { billEntries, rentEntries, tenancies, tenants, units } from "./schema";
import type { Database } from "./client";

const { db, close } = testDb();
const database = db as unknown as Database;

beforeEach(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await close();
});

async function aUnitAndTenant() {
  const [unit] = await db.insert(units).values({ label: "F1(B)", floor: "back" }).returning();
  const [tenant] = await db.insert(tenants).values({ name: "Anwar" }).returning();
  return { unit, tenant };
}

describe("a unit holds one tenancy at a time", () => {
  it("refuses a second tenancy overlapping an open-ended one", async () => {
    const { unit, tenant } = await aUnitAndTenant();
    await db.insert(tenancies).values({
      unitId: unit.id,
      tenantId: tenant.id,
      period: `[${SEED_YEAR}-07-01,)`,
      expectedRent: 6000,
    });

    const rejection = await expectRejection(
      db.insert(tenancies).values({
        unitId: unit.id,
        tenantId: tenant.id,
        period: `[${SEED_YEAR}-09-01,${SEED_YEAR}-12-01)`,
        expectedRent: 6000,
      }),
    );
    expect(rejection.constraint).toBe("tenancies_no_overlapping_period");
  });

  it("accepts adjacent tenancies that do not overlap", async () => {
    const { unit, tenant } = await aUnitAndTenant();
    const [second] = await db.insert(tenants).values({ name: "Rehana" }).returning();

    await db.insert(tenancies).values({
      unitId: unit.id,
      tenantId: tenant.id,
      period: `[${SEED_YEAR}-01-01,${SEED_YEAR}-07-01)`,
      expectedRent: 5500,
    });
    await db.insert(tenancies).values({
      unitId: unit.id,
      tenantId: second.id,
      period: `[${SEED_YEAR}-07-01,)`,
      expectedRent: 6000,
    });

    expect(await db.select().from(tenancies)).toHaveLength(2);
  });

  it("lets two different units both hold a tenancy over the same months", async () => {
    const { tenant } = await aUnitAndTenant();
    const [other] = await db.insert(units).values({ label: "B1", floor: "ground" }).returning();
    const [first] = await db.select().from(units).where(eq(units.label, "F1(B)"));

    await db.insert(tenancies).values({
      unitId: first.id,
      tenantId: tenant.id,
      period: `[${SEED_YEAR}-01-01,)`,
      expectedRent: 6000,
    });
    await db.insert(tenancies).values({
      unitId: other.id,
      tenantId: tenant.id,
      period: `[${SEED_YEAR}-01-01,)`,
      expectedRent: 11000,
    });

    expect(await db.select().from(tenancies)).toHaveLength(2);
  });
});

describe("history cannot be orphaned", () => {
  it("refuses to delete a tenant whose tenancy has rent recorded", async () => {
    const { unit, tenant } = await aUnitAndTenant();
    const [tenancy] = await db
      .insert(tenancies)
      .values({
        unitId: unit.id,
        tenantId: tenant.id,
        period: `[${SEED_YEAR}-01-01,)`,
        expectedRent: 6000,
      })
      .returning();
    await db.insert(rentEntries).values({
      tenancyId: tenancy.id,
      year: SEED_YEAR,
      month: 7,
      amount: 6000,
      status: "paid",
    });

    const tenancyRejection = await expectRejection(
      db.delete(tenancies).where(eq(tenancies.id, tenancy.id)),
    );
    expect(tenancyRejection.constraint).toBe("rent_entries_tenancy_id_tenancies_id_fk");

    const tenantRejection = await expectRejection(
      db.delete(tenants).where(eq(tenants.id, tenant.id)),
    );
    expect(tenantRejection.constraint).toBe("tenancies_tenant_id_tenants_id_fk");
  });

  it("allows deleting a unit created by mistake that nothing references", async () => {
    const [mistake] = await db.insert(units).values({ label: "F2(B", floor: "typo" }).returning();
    await db.delete(units).where(eq(units.id, mistake.id));
    expect(await db.select().from(units)).toHaveLength(0);
  });
});

describe("month and amount are bounded", () => {
  it("refuses a month outside the year", async () => {
    const { unit, tenant } = await aUnitAndTenant();
    const [tenancy] = await db
      .insert(tenancies)
      .values({
        unitId: unit.id,
        tenantId: tenant.id,
        period: `[${SEED_YEAR}-01-01,)`,
        expectedRent: 6000,
      })
      .returning();

    const rejection = await expectRejection(
      db.insert(rentEntries).values({
        tenancyId: tenancy.id,
        year: SEED_YEAR,
        month: 13,
        amount: 0,
        status: "upcoming",
      }),
    );
    expect(rejection.constraint).toBe("rent_entries_month_range");
  });
});

describe("the seed reproduces the sheet", () => {
  it("loads the 2026 figures the app shows today", async () => {
    await seed(database);

    const rent = await db.select().from(rentEntries);
    const bills = await db.select().from(billEntries);

    expect(rent.reduce((total, r) => total + r.amount, 0)).toBe(115_100);
    expect(bills.reduce((total, b) => total + b.amount, 0)).toBe(34_110);
    expect(rent).toHaveLength(36);
    expect(bills).toHaveLength(36);
  });

  it("scopes every entry to the seed year", async () => {
    await seed(database);
    const years = new Set((await db.select().from(rentEntries)).map((r) => r.year));
    expect([...years]).toEqual([SEED_YEAR]);
  });

  it("gives each unit its own open tenancy", async () => {
    await seed(database);
    const rows = await db.select().from(tenancies);
    expect(rows).toHaveLength(3);
    expect(rows.every((t) => t.period.endsWith(",)"))).toBe(true);
  });
});

describe("a period that ends before it starts cannot be stored", () => {
  it("is refused by the database even if application code lets one through", async () => {
    const { unit, tenant } = await aUnitAndTenant();
    const rejection = await expectRejection(
      db.insert(tenancies).values({
        unitId: unit.id,
        tenantId: tenant.id,
        // What toPeriod would produce for an end one month before the start.
        period: `[${SEED_YEAR}-06-01,${SEED_YEAR}-06-01)`,
        expectedRent: 6000,
      }),
    );
    expect(rejection.constraint).toBe("tenancies_period_not_empty");
  });
});
