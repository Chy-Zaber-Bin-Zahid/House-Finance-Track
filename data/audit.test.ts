import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { testDb, acquireSuiteLock, releaseSuiteLock, truncateAll } from "@/test/db";
import type { Database } from "@/db/client";
import { accounts } from "@/db/schema";
import { AccessDenied } from "./errors";
import { readAuditLog, record } from "./audit";
import type { Actor } from "./session";

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

async function anAccount(email: string, role: "owner" | "super_admin" | "viewer"): Promise<Actor> {
  const [row] = await db
    .insert(accounts)
    .values({ email, passwordHash: "x", status: "approved", role })
    .returning();
  return {
    accountId: row.id,
    email: row.email,
    role,
    status: "approved",
    sessionId: `session-${row.id}`,
    unlockedYear: null,
  };
}

describe("the audit log", () => {
  it("is the owner's alone", async () => {
    const owner = await anAccount("owner@example.com", "owner");
    const admin = await anAccount("admin@example.com", "super_admin");
    const viewer = await anAccount("viewer@example.com", "viewer");

    await expect(readAuditLog(database, admin)).rejects.toBeInstanceOf(AccessDenied);
    await expect(readAuditLog(database, viewer)).rejects.toBeInstanceOf(AccessDenied);
    await expect(readAuditLog(database, null)).rejects.toBeInstanceOf(AccessDenied);
    await expect(readAuditLog(database, owner)).resolves.toBeTruthy();
  });

  it("reads back newest first", async () => {
    const owner = await anAccount("owner@example.com", "owner");
    await record(database, owner, "unit.created", "B1");
    await record(database, owner, "unit.created", "F1(B)");
    await record(database, owner, "unit.created", "F1(F)");

    const page = await readAuditLog(database, owner);
    expect(page.events.map((e) => e.subject)).toEqual(["F1(F)", "F1(B)", "B1"]);
  });

  it("turns the stored key into words a person reads", async () => {
    const owner = await anAccount("owner@example.com", "owner");
    await record(database, owner, "tenancy.rent_changed", "F1(B) — Anwar", "6000 → 7000");

    const [event] = (await readAuditLog(database, owner)).events;
    expect(event.label).toBe("Changed the rent");
    expect(event.detail).toBe("6000 → 7000");
  });

  it("filters to one account", async () => {
    const owner = await anAccount("owner@example.com", "owner");
    const admin = await anAccount("admin@example.com", "super_admin");
    await record(database, owner, "unit.created", "B1");
    await record(database, admin, "unit.created", "F1(B)");

    const mine = await readAuditLog(database, owner, { actorEmail: "admin@example.com" });
    expect(mine.events.map((e) => e.subject)).toEqual(["F1(B)"]);
    expect(mine.actors).toEqual(["admin@example.com", "owner@example.com"]);
  });

  it("keeps the line after the account behind it is gone", async () => {
    const owner = await anAccount("owner@example.com", "owner");
    const admin = await anAccount("admin@example.com", "super_admin");
    await record(database, admin, "unit.removed", "B1");

    await db.delete(accounts).where(eq(accounts.id, admin.accountId));

    const [event] = (await readAuditLog(database, owner)).events;
    /* The email is the record; the foreign key is only the live link. */
    expect(event.actorEmail).toBe("admin@example.com");
    expect(event.stillAnAccount).toBe(false);
  });

  it("never lets a failed write take the change down with it", async () => {
    const owner = await anAccount("owner@example.com", "owner");
    /* An action longer than the column allows would throw from the insert. */
    await expect(
      record(database, owner, "unit.created", "x".repeat(5_000), "y".repeat(5_000)),
    ).resolves.toBeUndefined();
  });
});
