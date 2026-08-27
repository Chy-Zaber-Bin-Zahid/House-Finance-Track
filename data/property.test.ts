import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { rentEntries } from "@/db/schema";
import { testDb, truncateAll } from "@/test/db";
import type { Database } from "@/db/client";
import { NotFound, StillReferenced } from "./errors";
import {
  createTenancy,
  createTenant,
  createUnit,
  deleteTenant,
  deleteUnit,
  endTenancy,
  listTenancies,
  OverlappingTenancy,
  tenantHistory,
} from "./property";

const { db, close } = testDb();
const database = db as unknown as Database;

beforeEach(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await close();
});

describe("units and tenants are managed apart", () => {
  it("creates a tenant with no unit attached", async () => {
    const tenant = await createTenant(database, "Anwar Hossain", "01711 204 866");
    expect(tenant.name).toBe("Anwar Hossain");
    expect(await listTenancies(database)).toEqual([]);
  });

  it("creates a unit with no tenant attached", async () => {
    const unit = await createUnit(database, "F1(B)", "First floor, back");
    expect(unit.label).toBe("F1(B)");
  });
});

describe("a unit changes hands mid-year", () => {
  it("keeps one unit while each tenant keeps their own months", async () => {
    const unit = await createUnit(database, "F1(B)", "back");
    const anwar = await createTenant(database, "Anwar");
    const rehana = await createTenant(database, "Rehana");

    const first = await createTenancy(database, {
      unitId: unit.id,
      tenantId: anwar.id,
      start: { year: 2026, month: 1 },
      end: null,
      expectedRent: 5500,
    });

    await endTenancy(database, first.id, { year: 2026, month: 6 });

    const second = await createTenancy(database, {
      unitId: unit.id,
      tenantId: rehana.id,
      start: { year: 2026, month: 7 },
      end: null,
      expectedRent: 6000,
    });

    await db.insert(rentEntries).values([
      { tenancyId: first.id, year: 2026, month: 3, amount: 5500, status: "paid" },
      { tenancyId: second.id, year: 2026, month: 8, amount: 6000, status: "paid" },
    ]);

    const held = await listTenancies(database);
    expect(held).toHaveLength(2);
    expect(new Set(held.map((t) => t.unitLabel))).toEqual(new Set(["F1(B)"]));

    const anwarHistory = await tenantHistory(database, anwar.id);
    const rehanaHistory = await tenantHistory(database, rehana.id);
    expect(anwarHistory.tenancies[0].collected).toBe(5500);
    expect(anwarHistory.tenancies[0].end).toEqual({ year: 2026, month: 6 });
    expect(rehanaHistory.tenancies[0].collected).toBe(6000);
    expect(rehanaHistory.tenancies[0].end).toBeNull();
  });

  it("refuses a second tenancy while the first is still open", async () => {
    const unit = await createUnit(database, "F1(B)", "back");
    const anwar = await createTenant(database, "Anwar");
    const rehana = await createTenant(database, "Rehana");

    await createTenancy(database, {
      unitId: unit.id,
      tenantId: anwar.id,
      start: { year: 2026, month: 1 },
      end: null,
      expectedRent: 5500,
    });

    await expect(
      createTenancy(database, {
        unitId: unit.id,
        tenantId: rehana.id,
        start: { year: 2026, month: 7 },
        end: null,
        expectedRent: 6000,
      }),
    ).rejects.toThrow(OverlappingTenancy);
  });
});

describe("a departed tenant keeps their history", () => {
  it("still lists what they paid after their tenancy ended", async () => {
    const unit = await createUnit(database, "F1(B)", "back");
    const anwar = await createTenant(database, "Anwar");
    const tenancy = await createTenancy(database, {
      unitId: unit.id,
      tenantId: anwar.id,
      start: { year: 2026, month: 1 },
      end: null,
      expectedRent: 5500,
    });
    await db.insert(rentEntries).values({
      tenancyId: tenancy.id,
      year: 2026,
      month: 3,
      amount: 5500,
      status: "paid",
    });
    await endTenancy(database, tenancy.id, { year: 2026, month: 6 });

    const history = await tenantHistory(database, anwar.id);
    expect(history.tenant.name).toBe("Anwar");
    expect(history.tenancies[0].collected).toBe(5500);
    expect(history.tenancies[0].entries).toHaveLength(1);
  });
});

describe("deleting", () => {
  it("refuses a tenant with money recorded, and says what to do instead", async () => {
    const unit = await createUnit(database, "F1(B)", "back");
    const anwar = await createTenant(database, "Anwar");
    const tenancy = await createTenancy(database, {
      unitId: unit.id,
      tenantId: anwar.id,
      start: { year: 2026, month: 1 },
      end: null,
      expectedRent: 5500,
    });
    await db.insert(rentEntries).values({
      tenancyId: tenancy.id,
      year: 2026,
      month: 3,
      amount: 5500,
      status: "paid",
    });

    await expect(deleteTenant(database, anwar.id)).rejects.toThrow(StillReferenced);
    await expect(deleteUnit(database, unit.id)).rejects.toThrow(StillReferenced);
  });

  it("allows removing a unit typed by mistake", async () => {
    const mistake = await createUnit(database, "F2(B", "typo");
    await deleteUnit(database, mistake.id);
    expect(await listTenancies(database)).toEqual([]);
  });

  it("reports a missing record rather than succeeding quietly", async () => {
    await expect(deleteUnit(database, 9_999)).rejects.toThrow(NotFound);
    await expect(tenantHistory(database, 9_999)).rejects.toThrow(NotFound);
  });
});
