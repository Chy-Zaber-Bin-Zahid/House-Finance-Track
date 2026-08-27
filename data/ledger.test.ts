import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, truncateAll } from "@/test/db";
import type { Database } from "@/db/client";
import { seed, SEED_YEAR } from "@/db/seed";
import { StillReferenced } from "./errors";
import {
  billTypesForYear,
  createBillType,
  deleteBillType,
  listBillTypes,
  monthTotals,
  setBillAmount,
  setBillTypeActive,
  setRentAmount,
  tenanciesForMonth,
  yearSheet,
  yearsWithData,
  yearTotals,
} from "./ledger";
import { createTenancy, createTenant, createUnit, endTenancy } from "./property";

const { db, close } = testDb();
const database = db as unknown as Database;

beforeEach(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await close();
});

describe("bill types are data", () => {
  it("adds one without a migration", async () => {
    await createBillType(database, "Internet");
    expect((await listBillTypes(database)).map((b) => b.name)).toContain("Internet");
  });

  it("keeps a retired type on the years that already have amounts for it", async () => {
    const internet = await createBillType(database, "Internet");
    await setBillAmount(database, internet.id, 2026, 3, { amount: 1200, status: "paid" });
    await setBillTypeActive(database, internet.id, false);

    expect((await billTypesForYear(database, 2026)).map((b) => b.name)).toContain("Internet");
    expect((await billTypesForYear(database, 2027)).map((b) => b.name)).not.toContain("Internet");
  });

  it("brings a retired type back without touching what it recorded", async () => {
    const internet = await createBillType(database, "Internet");
    await setBillAmount(database, internet.id, 2026, 3, { amount: 1200, status: "paid" });
    await setBillTypeActive(database, internet.id, false);
    await setBillTypeActive(database, internet.id, true);

    const sheet = await yearSheet(database, 2026);
    expect(sheet.months[2].bills[internet.id]).toEqual({ amount: 1200, status: "paid" });
  });

  it("refuses to delete a type with amounts, and allows one without", async () => {
    const used = await createBillType(database, "Internet");
    const unused = await createBillType(database, "Typo");
    await setBillAmount(database, used.id, 2026, 3, { amount: 1200, status: "paid" });

    await expect(deleteBillType(database, used.id)).rejects.toThrow(StillReferenced);
    await deleteBillType(database, unused.id);
    expect((await listBillTypes(database)).map((b) => b.name)).toEqual(["Internet"]);
  });
});

describe("recording money", () => {
  async function aTenancy() {
    const unit = await createUnit(database, "F1(B)", "back");
    const tenant = await createTenant(database, "Anwar");
    return createTenancy(database, {
      unitId: unit.id,
      tenantId: tenant.id,
      start: { year: 2026, month: 1 },
      end: null,
      expectedRent: 6000,
    });
  }

  it("creates a cell on first write and updates it after", async () => {
    const tenancy = await aTenancy();
    await setRentAmount(database, tenancy.id, 2026, 7, { amount: 5500, status: "paid" });
    expect((await monthTotals(database, 2026, 7)).rent).toBe(5500);

    await setRentAmount(database, tenancy.id, 2026, 7, { amount: 6000 });
    const totals = await monthTotals(database, 2026, 7);
    expect(totals.rent).toBe(6000);
  });

  it("changes a status without disturbing the amount", async () => {
    const tenancy = await aTenancy();
    await setRentAmount(database, tenancy.id, 2026, 7, { amount: 5500, status: "upcoming" });
    await setRentAmount(database, tenancy.id, 2026, 7, { status: "paid" });

    const sheet = await yearSheet(database, 2026);
    const unitId = sheet.units[0].id;
    expect(sheet.months[6].rent[unitId]).toMatchObject({ amount: 5500, status: "paid" });
  });

  it("leaves the second of two writes standing, with no lock", async () => {
    const tenancy = await aTenancy();
    await Promise.all([
      setRentAmount(database, tenancy.id, 2026, 7, { amount: 1 }),
      setRentAmount(database, tenancy.id, 2026, 7, { amount: 2 }),
    ]);
    expect([1, 2]).toContain((await monthTotals(database, 2026, 7)).rent);
  });
});

describe("a month only lists units someone was renting", () => {
  it("leaves out a unit whose tenancy had already ended", async () => {
    const unit = await createUnit(database, "F1(B)", "back");
    const tenant = await createTenant(database, "Anwar");
    const tenancy = await createTenancy(database, {
      unitId: unit.id,
      tenantId: tenant.id,
      start: { year: 2026, month: 1 },
      end: null,
      expectedRent: 6000,
    });
    await endTenancy(database, tenancy.id, { year: 2026, month: 6 });

    expect(await tenanciesForMonth(database, 2026, 3)).toHaveLength(1);
    expect(await tenanciesForMonth(database, 2026, 9)).toHaveLength(0);
  });
});

describe("the sheet reads the year the seed produced", () => {
  it("reports the same totals the app shows today", async () => {
    await seed(database);
    expect(await yearTotals(database, SEED_YEAR)).toEqual({
      rent: 115_100,
      bills: 34_110,
      kept: 80_990,
    });
  });

  it("gives every month a cell for every unit and bill type", async () => {
    await seed(database);
    const sheet = await yearSheet(database, SEED_YEAR);
    expect(sheet.months).toHaveLength(12);
    expect(sheet.units).toHaveLength(3);
    expect(sheet.billTypes.map((b) => b.name)).toEqual(["Water", "Gas", "Current"]);
    for (const month of sheet.months) {
      expect(Object.keys(month.rent)).toHaveLength(3);
      expect(Object.keys(month.bills)).toHaveLength(3);
    }
  });

  it("offers the years that hold data, newest first", async () => {
    await seed(database);
    const internet = await createBillType(database, "Internet");
    await setBillAmount(database, internet.id, 2027, 1, { amount: 900, status: "paid" });
    expect(await yearsWithData(database)).toEqual([2027, 2026]);
  });

  it("renders an untouched year as empty rather than failing", async () => {
    await seed(database);
    const sheet = await yearSheet(database, 2028);
    expect(sheet.months).toHaveLength(12);
    expect(await yearTotals(database, 2028)).toEqual({ rent: 0, bills: 0, kept: 0 });
  });

  it("shows an empty sheet when every unit and bill type is gone", async () => {
    const sheet = await yearSheet(database, 2026);
    expect(sheet.units).toEqual([]);
    expect(sheet.billTypes).toEqual([]);
    expect(sheet.months).toHaveLength(12);
  });
});
