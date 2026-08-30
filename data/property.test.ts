import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { rentEntries } from "@/db/schema";
import { testDb, acquireSuiteLock, releaseSuiteLock, truncateAll } from "@/test/db";
import type { Database } from "@/db/client";
import { NotFound, StillReferenced } from "./errors";
import { BackwardsPeriod } from "./period";
import {
  changeRentFrom,
  createTenancy,
  createTenant,
  createUnit,
  deleteTenant,
  deleteUnit,
  endTenancy,
  listTenancies,
  OverlappingTenancy,
  RentChangeOutsideTenancy,
  setExpectedRent,
  tenantHistory,
} from "./property";

const { db, close } = testDb();
const database = db as unknown as Database;

beforeAll(async () => {
  await acquireSuiteLock(db);
});

beforeEach(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await releaseSuiteLock(db);
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

describe("a tenancy cannot end before it starts", () => {
  it("refuses an end month before the start, rather than storing an unreadable period", async () => {
    const unit = await createUnit(database, "F1(B)", "back");
    const anwar = await createTenant(database, "Anwar");
    const tenancy = await createTenancy(database, {
      unitId: unit.id,
      tenantId: anwar.id,
      start: { year: 2026, month: 6 },
      end: null,
      expectedRent: 6000,
    });

    await expect(endTenancy(database, tenancy.id, { year: 2026, month: 5 })).rejects.toThrow(
      BackwardsPeriod,
    );

    /* The tenancy is untouched, and every read path still works. */
    const held = await listTenancies(database);
    expect(held).toHaveLength(1);
    expect(held[0].end).toBeNull();
  });

  it("refuses one at creation too", async () => {
    const unit = await createUnit(database, "B1", "ground");
    const kamal = await createTenant(database, "Kamal");
    await expect(
      createTenancy(database, {
        unitId: unit.id,
        tenantId: kamal.id,
        start: { year: 2026, month: 6 },
        end: { year: 2026, month: 1 },
        expectedRent: 11000,
      }),
    ).rejects.toThrow(BackwardsPeriod);
  });
});

describe("rent is not fixed", () => {
  async function letAt(rent: number, end: { year: number; month: number } | null = null) {
    const unit = await createUnit(database, "F1(B)", "back");
    const tenant = await createTenant(database, "Anwar");
    const tenancy = await createTenancy(database, {
      unitId: unit.id,
      tenantId: tenant.id,
      start: { year: 2026, month: 1 },
      end,
      expectedRent: rent,
    });
    return { unit, tenant, tenancy };
  }

  it("splits the tenancy so earlier months keep the figure they were let at", async () => {
    const { tenancy } = await letAt(6000);

    const result = await changeRentFrom(database, tenancy.id, { year: 2026, month: 7 }, 7000);
    expect(result.split).toBe(true);

    const held = await listTenancies(database);
    expect(held).toHaveLength(2);

    const before = held.find((t) => t.id === tenancy.id);
    const after = held.find((t) => t.id === result.tenancy.id);
    expect(before).toMatchObject({ expectedRent: 6000, end: { year: 2026, month: 6 } });
    expect(after).toMatchObject({ expectedRent: 7000, start: { year: 2026, month: 7 }, end: null });
  });

  it("leaves no gap between the old figure and the new one", async () => {
    const { tenancy } = await letAt(6000);
    const result = await changeRentFrom(database, tenancy.id, { year: 2026, month: 7 }, 7000);

    const held = await listTenancies(database);
    const before = held.find((t) => t.id === tenancy.id)!;
    const after = held.find((t) => t.id === result.tenancy.id)!;
    /* June ends the first, July opens the second: every month has exactly one. */
    expect(before.end).toEqual({ year: 2026, month: 6 });
    expect(after.start).toEqual({ year: 2026, month: 7 });
  });

  it("goes down as readily as up", async () => {
    const { tenancy } = await letAt(6000);
    const result = await changeRentFrom(database, tenancy.id, { year: 2026, month: 4 }, 4500);

    const held = await listTenancies(database);
    expect(held.find((t) => t.id === result.tenancy.id)?.expectedRent).toBe(4500);
  });

  it("changes again within the same year", async () => {
    const { tenancy } = await letAt(6000);
    const second = await changeRentFrom(database, tenancy.id, { year: 2026, month: 4 }, 6500);
    const third = await changeRentFrom(database, second.tenancy.id, { year: 2026, month: 9 }, 7000);

    const held = await listTenancies(database);
    expect(held).toHaveLength(3);
    expect(held.find((t) => t.id === third.tenancy.id)).toMatchObject({
      expectedRent: 7000,
      start: { year: 2026, month: 9 },
    });
  });

  it("carries rent already recorded across to the tenancy that now owns those months", async () => {
    const { tenancy } = await letAt(6000);
    await db.insert(rentEntries).values([
      { tenancyId: tenancy.id, year: 2026, month: 3, amount: 6000, status: "paid" },
      { tenancyId: tenancy.id, year: 2026, month: 8, amount: 7000, status: "paid" },
    ]);

    const result = await changeRentFrom(database, tenancy.id, { year: 2026, month: 7 }, 7000);

    const history = await tenantHistory(database, (await listTenancies(database))[0].tenantId);
    const old = history.tenancies.find((t) => t.id === tenancy.id);
    const fresh = history.tenancies.find((t) => t.id === result.tenancy.id);
    /* March stayed put; August moved with the months it belongs to. */
    expect(old?.entries.map((e) => e.month)).toEqual([3]);
    expect(fresh?.entries.map((e) => e.month)).toEqual([8]);
    /* Neither amount was rewritten by the change. */
    expect(old?.collected).toBe(6000);
    expect(fresh?.collected).toBe(7000);
  });

  it("changing from the start month is a correction, not a split", async () => {
    const { tenancy } = await letAt(6000);

    const result = await changeRentFrom(database, tenancy.id, { year: 2026, month: 1 }, 6500);

    expect(result.split).toBe(false);
    const held = await listTenancies(database);
    expect(held).toHaveLength(1);
    expect(held[0].expectedRent).toBe(6500);
  });

  it("refuses a month the tenancy had already ended by", async () => {
    const { tenancy } = await letAt(6000, { year: 2026, month: 6 });

    await expect(
      changeRentFrom(database, tenancy.id, { year: 2026, month: 9 }, 7000),
    ).rejects.toBeInstanceOf(RentChangeOutsideTenancy);
  });

  it("corrects a mistyped figure across every month without touching the period", async () => {
    const { tenancy } = await letAt(6000, { year: 2026, month: 6 });

    await setExpectedRent(database, tenancy.id, 5500);

    const held = await listTenancies(database);
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({
      expectedRent: 5500,
      start: { year: 2026, month: 1 },
      end: { year: 2026, month: 6 },
    });
  });

  it("refuses to correct a tenancy that is not there", async () => {
    await expect(setExpectedRent(database, 9999, 5500)).rejects.toBeInstanceOf(NotFound);
  });
});
