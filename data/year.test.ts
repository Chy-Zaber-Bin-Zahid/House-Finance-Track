import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { accounts, sessions, tenants } from "@/db/schema";
import { testDb, acquireSuiteLock, releaseSuiteLock, truncateAll } from "@/test/db";
import type { Database } from "@/db/client";
import { AccessDenied } from "./errors";
import { requireEditorForYear } from "./guard";
import { createSessionToken, hashToken, sessionExpiry, verifySession } from "./session";
import {
  createTenancy,
  createTenant,
  createUnit,
  deleteTenancy,
  endTenancy,
  updateTenant,
} from "./property";
import { relockYear, unlockYear, yearState } from "./year";

const { db, close } = testDb();
const database = db as unknown as Database;
const NOW = new Date("2026-08-27T12:00:00Z");

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

async function anEditor(email = "brother@example.com") {
  const [account] = await db
    .insert(accounts)
    .values({ email, passwordHash: "x", status: "approved", role: "super_admin" })
    .returning();
  const token = createSessionToken();
  await db.insert(sessions).values({ id: hashToken(token), accountId: account.id, expiresAt: sessionExpiry() });
  return { token, actor: (await verifySession(database, token))! };
}

describe("unlocking a past year", () => {
  it("lets the session that unlocked it write, and only to that year", async () => {
    const { token, actor } = await anEditor();
    expect(() => requireEditorForYear(actor, 2025, NOW)).toThrow(AccessDenied);

    await unlockYear(database, actor, 2025, NOW);
    const unlocked = await verifySession(database, token);

    expect(() => requireEditorForYear(unlocked, 2025, NOW)).not.toThrow();
    expect(() => requireEditorForYear(unlocked, 2024, NOW)).toThrow(AccessDenied);
  });

  it("leaves the year read-only for a different session", async () => {
    const holder = await anEditor("brother@example.com");
    await unlockYear(database, holder.actor, 2025, NOW);

    const other = await anEditor("father@example.com");
    expect(() => requireEditorForYear(other.actor, 2025, NOW)).toThrow(AccessDenied);
  });

  it("dies with the session that opened it", async () => {
    const { token, actor } = await anEditor();
    await unlockYear(database, actor, 2025, NOW);
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
    expect(await verifySession(database, token)).toBeNull();
  });

  it("can be given back before the session ends", async () => {
    const { token, actor } = await anEditor();
    await unlockYear(database, actor, 2025, NOW);
    await relockYear(database, (await verifySession(database, token))!);
    const relocked = await verifySession(database, token);
    expect(() => requireEditorForYear(relocked, 2025, NOW)).toThrow(AccessDenied);
  });

  it("refuses to unlock the current year, which is already open", async () => {
    const { actor } = await anEditor();
    await expect(unlockYear(database, actor, 2026, NOW)).rejects.toThrow(AccessDenied);
  });

  it("refuses a year that has not started", async () => {
    const { actor } = await anEditor();
    await expect(unlockYear(database, actor, 2027, NOW)).rejects.toThrow(AccessDenied);
  });
});

describe("what the year screen shows", () => {
  it("marks the current year editable with nothing to unlock", async () => {
    const { actor } = await anEditor();
    expect(yearState(actor, 2026, NOW)).toEqual({
      year: 2026,
      isCurrent: true,
      editable: true,
      canUnlock: false,
    });
  });

  it("marks a past year read-only and offers the unlock to an editor", async () => {
    const { actor } = await anEditor();
    expect(yearState(actor, 2025, NOW)).toMatchObject({ editable: false, canUnlock: true });
  });

  it("offers a viewer no unlock at all", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ email: "father@example.com", passwordHash: "x", status: "approved", role: "viewer" })
      .returning();
    const token = createSessionToken();
    await db.insert(sessions).values({ id: hashToken(token), accountId: account.id, expiresAt: sessionExpiry() });
    const actor = (await verifySession(database, token))!;
    expect(yearState(actor, 2025, NOW)).toMatchObject({ editable: false, canUnlock: false });
  });
});

describe("the year lock covers every write that moves money between months", () => {
  async function aUnitTenantAndTenancy(year: number) {
    const unit = await createUnit(database, `U${year}`, "somewhere");
    const tenant = await createTenant(database, `T${year}`);
    const tenancy = await createTenancy(database, {
      unitId: unit.id,
      tenantId: tenant.id,
      start: { year, month: 1 },
      end: null,
      expectedRent: 1000,
    });
    return { unit, tenant, tenancy };
  }

  it("refuses opening a tenancy in a locked year", async () => {
    const { actor } = await anEditor();
    const unit = await createUnit(database, "F1(B)", "back");
    const tenant = await createTenant(database, "Anwar");

    await expect(
      createTenancy(
        database,
        {
          unitId: unit.id,
          tenantId: tenant.id,
          start: { year: 2025, month: 1 },
          end: null,
          expectedRent: 6000,
        },
        actor,
      ),
    ).rejects.toThrow(AccessDenied);
  });

  it("refuses ending a tenancy so that a locked year loses months", async () => {
    const { tenancy } = await aUnitTenantAndTenancy(2025);
    const { actor } = await anEditor();

    await expect(
      endTenancy(database, tenancy.id, { year: 2025, month: 6 }, actor),
    ).rejects.toThrow(AccessDenied);
  });

  it("allows the same edit once that year is unlocked for this session", async () => {
    const { tenancy } = await aUnitTenantAndTenancy(2025);
    const editor = await anEditor();
    await unlockYear(database, editor.actor, 2025, NOW);
    const unlocked = await verifySession(database, editor.token);

    await expect(
      endTenancy(database, tenancy.id, { year: 2025, month: 6 }, unlocked!),
    ).resolves.toBeDefined();
  });

  it("still allows renaming a tenant, which is identity rather than money", async () => {
    await aUnitTenantAndTenancy(2025);
    const [tenant] = await db.select().from(tenants);
    /* No actor argument: renames are deliberately not year-scoped. */
    await expect(
      updateTenant(database, tenant.id, { name: "Corrected Spelling" }),
    ).resolves.toMatchObject({ name: "Corrected Spelling" });
  });

  it("refuses deleting a tenancy that covered a locked year", async () => {
    const { tenancy } = await aUnitTenantAndTenancy(2025);
    const { actor } = await anEditor();
    await expect(deleteTenancy(database, tenancy.id, actor)).rejects.toThrow(AccessDenied);
  });
});
