import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { accounts, sessions } from "@/db/schema";
import { testDb, truncateAll } from "@/test/db";
import type { Database } from "@/db/client";
import { AccessDenied } from "./errors";
import {
  currentYear,
  requireApproved,
  requireEditor,
  requireEditorForYear,
  requireOwner,
  requireWritableYear,
} from "./guard";
import {
  createSessionToken,
  destroyOtherSessions,
  destroySession,
  hashToken,
  sessionExpiry,
  verifySession,
} from "./session";

const { db, close } = testDb();
const database = db as unknown as Database;

beforeEach(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await close();
});

type Role = "owner" | "super_admin" | "viewer";
type Status = "awaiting" | "approved" | "rejected";

async function anAccountWithSession(
  role: Role | null,
  status: Status = "approved",
  expiresAt: Date = sessionExpiry(),
) {
  const [account] = await db
    .insert(accounts)
    .values({ email: `${role ?? "none"}-${status}@example.com`, passwordHash: "x", role, status })
    .returning();
  const token = createSessionToken();
  await db.insert(sessions).values({ id: hashToken(token), accountId: account.id, expiresAt });
  return { account, token };
}

describe("verifySession", () => {
  it("resolves the caller behind a live token", async () => {
    const { account, token } = await anAccountWithSession("super_admin");
    const actor = await verifySession(database, token);
    expect(actor?.accountId).toBe(account.id);
    expect(actor?.role).toBe("super_admin");
  });

  it("refuses a token naming a session that does not exist", async () => {
    await anAccountWithSession("super_admin");
    expect(await verifySession(database, createSessionToken())).toBeNull();
  });

  it("refuses an expired session even when the cookie is intact", async () => {
    const { token } = await anAccountWithSession("super_admin", "approved", new Date(Date.now() - 1000));
    expect(await verifySession(database, token)).toBeNull();
  });

  it("refuses when no token is presented at all", async () => {
    expect(await verifySession(database, undefined)).toBeNull();
  });

  it("stores only a hash, never the token", async () => {
    const { token } = await anAccountWithSession("viewer");
    const [row] = await db.select().from(sessions);
    expect(row.id).not.toBe(token);
    expect(row.id).toBe(hashToken(token));
  });

  it("forgets a session once it is destroyed", async () => {
    const { token } = await anAccountWithSession("viewer");
    await destroySession(database, token);
    expect(await verifySession(database, token)).toBeNull();
  });
});

describe("a viewer can read and cannot write", () => {
  it("refuses a viewer every write, and says why", async () => {
    const { token } = await anAccountWithSession("viewer");
    const actor = await verifySession(database, token);

    expect(() => requireApproved(actor)).not.toThrow();
    expect(() => requireEditor(actor)).toThrow(AccessDenied);
    try {
      requireEditor(actor);
    } catch (error) {
      expect((error as AccessDenied).reason).toBe("read-only");
    }
  });

  it("lets an editor and the owner write", async () => {
    const editor = await verifySession(database, (await anAccountWithSession("super_admin")).token);
    const owner = await verifySession(database, (await anAccountWithSession("owner")).token);
    expect(() => requireEditor(editor)).not.toThrow();
    expect(() => requireEditor(owner)).not.toThrow();
  });
});

describe("access follows the database, not the cookie", () => {
  it("refuses a demoted account on its next request, with no new sign-in", async () => {
    const { account, token } = await anAccountWithSession("super_admin");
    const before = await verifySession(database, token);
    expect(() => requireEditor(before)).not.toThrow();

    await db.update(accounts).set({ role: "viewer" }).where(eq(accounts.id, account.id));

    const after = await verifySession(database, token);
    expect(() => requireEditor(after)).toThrow(AccessDenied);
  });

  it("refuses an account rejected while its session was live", async () => {
    const { account, token } = await anAccountWithSession("super_admin");
    await db.update(accounts).set({ status: "rejected" }).where(eq(accounts.id, account.id));

    const actor = await verifySession(database, token);
    expect(() => requireApproved(actor)).toThrow(AccessDenied);
    try {
      requireApproved(actor);
    } catch (error) {
      expect((error as AccessDenied).reason).toBe("rejected");
    }
  });

  it("refuses an account still waiting to be approved", async () => {
    const { token } = await anAccountWithSession(null, "awaiting");
    const actor = await verifySession(database, token);
    try {
      requireApproved(actor);
      throw new Error("should have refused");
    } catch (error) {
      expect((error as AccessDenied).reason).toBe("awaiting-approval");
    }
  });
});

describe("account administration is the owner's alone", () => {
  it("refuses a super-admin the approval powers", async () => {
    const actor = await verifySession(database, (await anAccountWithSession("super_admin")).token);
    expect(() => requireOwner(actor)).toThrow(AccessDenied);
  });

  it("allows the owner", async () => {
    const actor = await verifySession(database, (await anAccountWithSession("owner")).token);
    expect(() => requireOwner(actor)).not.toThrow();
  });
});

describe("past years are read-only until unlocked", () => {
  const now = new Date("2026-08-27T12:00:00Z");

  it("allows a write to the current year with no unlock", async () => {
    const actor = await verifySession(database, (await anAccountWithSession("super_admin")).token);
    expect(() => requireEditorForYear(actor, currentYear(now), now)).not.toThrow();
  });

  it("refuses a write to a past year without an unlock", async () => {
    const actor = await verifySession(database, (await anAccountWithSession("super_admin")).token);
    expect(() => requireEditorForYear(actor, 2025, now)).toThrow(AccessDenied);
  });

  it("allows the session that holds the unlock, and only for that year", async () => {
    const { token } = await anAccountWithSession("super_admin");
    await db.update(sessions).set({ unlockedYear: 2025 }).where(eq(sessions.id, hashToken(token)));
    const actor = await verifySession(database, token);

    expect(() => requireWritableYear(actor!, 2025, now)).not.toThrow();
    expect(() => requireWritableYear(actor!, 2024, now)).toThrow(AccessDenied);
  });

  it("leaves the year locked for a different session", async () => {
    const holder = await anAccountWithSession("super_admin");
    await db.update(sessions).set({ unlockedYear: 2025 }).where(eq(sessions.id, hashToken(holder.token)));

    const other = await anAccountWithSession("owner");
    const otherActor = await verifySession(database, other.token);
    expect(() => requireWritableYear(otherActor!, 2025, now)).toThrow(AccessDenied);
  });
});

describe("a password change ends the account's other sessions", () => {
  it("keeps the current session and drops the rest", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ email: "owner@example.com", passwordHash: "x", role: "owner", status: "approved" })
      .returning();

    const keep = createSessionToken();
    const other = createSessionToken();
    await db.insert(sessions).values([
      { id: hashToken(keep), accountId: account.id, expiresAt: sessionExpiry() },
      { id: hashToken(other), accountId: account.id, expiresAt: sessionExpiry() },
    ]);

    await destroyOtherSessions(database, account.id, hashToken(keep));

    expect(await verifySession(database, keep)).not.toBeNull();
    expect(await verifySession(database, other)).toBeNull();
  });
});
