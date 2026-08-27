import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { accounts } from "@/db/schema";
import { testDb, acquireSuiteLock, releaseSuiteLock, truncateAll } from "@/test/db";
import type { Database } from "@/db/client";
import { seedOwner } from "./owner";
import { verifyPassword } from "./passwords";

const { db, close } = testDb();
const database = db as unknown as Database;
const ENV = { email: "owner@example.com", password: "the-owners-long-password" };

beforeAll(async () => {
  await acquireSuiteLock(db);
});

beforeEach(async () => {
  await truncateAll(db);
  vi.restoreAllMocks();
});

afterAll(async () => {
  await releaseSuiteLock(db);
  await close();
});

describe("seeding the owner", () => {
  it("creates exactly one owner on a first boot", async () => {
    expect(await seedOwner(database, ENV)).toBe("created");
    const rows = await db.select().from(accounts).where(eq(accounts.role, "owner"));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("approved");
    expect(await verifyPassword(rows[0].passwordHash, ENV.password)).toBe(true);
  });

  it("does not duplicate the owner on a second boot", async () => {
    await seedOwner(database, ENV);
    expect(await seedOwner(database, ENV)).toBe("kept");
    expect(await db.select().from(accounts)).toHaveLength(1);
  });

  it("leaves a password changed in the app alone on the next boot", async () => {
    await seedOwner(database, ENV);
    await db
      .update(accounts)
      .set({ passwordHash: "changed-in-the-app" })
      .where(eq(accounts.email, ENV.email));

    expect(await seedOwner(database, ENV)).toBe("kept");
    const [row] = await db.select().from(accounts);
    expect(row.passwordHash).toBe("changed-in-the-app");
  });

  it("overwrites the password only when the reseed flag is set", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await seedOwner(database, ENV);
    await db.update(accounts).set({ passwordHash: "forgotten" }).where(eq(accounts.email, ENV.email));

    expect(await seedOwner(database, { ...ENV, reseed: "true" })).toBe("reseeded");
    const [row] = await db.select().from(accounts);
    expect(await verifyPassword(row.passwordHash, ENV.password)).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });

  it("fails loudly rather than starting with no way in", async () => {
    await expect(seedOwner(database, { email: "", password: "" })).rejects.toThrow(
      /must both be set/,
    );
    await expect(seedOwner(database, { email: ENV.email, password: undefined })).rejects.toThrow();
  });

  it("refuses an owner password too short to be worth hashing", async () => {
    await expect(seedOwner(database, { email: ENV.email, password: "short" })).rejects.toThrow();
    expect(await db.select().from(accounts)).toHaveLength(0);
  });
});
