import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { accounts, sessions } from "@/db/schema";
import { testDb, truncateAll } from "@/test/db";
import type { Database } from "@/db/client";
import { approve, listAccounts, reject, resetPassword, setRole } from "./approvals";
import { NotFound } from "./errors";
import { requireEditor, requireOwner } from "./guard";
import { hashPassword, verifyPassword } from "./passwords";
import { createSessionToken, hashToken, sessionExpiry, verifySession } from "./session";

const { db, close } = testDb();
const database = db as unknown as Database;

beforeEach(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await close();
});

async function anAccount(email: string, status: "awaiting" | "approved" = "awaiting", role: "super_admin" | "viewer" | null = null) {
  const [account] = await db
    .insert(accounts)
    .values({ email, passwordHash: await hashPassword("a-long-enough-password"), status, role })
    .returning();
  return account;
}

async function aSessionFor(accountId: number) {
  const token = createSessionToken();
  await db.insert(sessions).values({ id: hashToken(token), accountId, expiresAt: sessionExpiry() });
  return token;
}

describe("the owner's list", () => {
  it("shows accounts newest first and never the owner", async () => {
    await db.insert(accounts).values({
      email: "owner@example.com",
      passwordHash: "x",
      status: "approved",
      role: "owner",
    });
    await anAccount("brother@example.com");
    await anAccount("father@example.com");

    const listed = await listAccounts(database);
    expect(listed.map((a) => a.email)).toEqual(["father@example.com", "brother@example.com"]);
  });

  it("is empty before anyone has asked for access", async () => {
    expect(await listAccounts(database)).toEqual([]);
  });
});

describe("approving", () => {
  it("lets an approved editor write, and an approved viewer only read", async () => {
    const editor = await anAccount("brother@example.com");
    const viewer = await anAccount("father@example.com");
    await approve(database, editor.id, "super_admin");
    await approve(database, viewer.id, "viewer");

    const editorActor = await verifySession(database, await aSessionFor(editor.id));
    const viewerActor = await verifySession(database, await aSessionFor(viewer.id));

    expect(() => requireEditor(editorActor)).not.toThrow();
    expect(() => requireEditor(viewerActor)).toThrow();
  });

  it("promotes a viewer without needing a new sign-in", async () => {
    const account = await anAccount("father@example.com");
    await approve(database, account.id, "viewer");
    const token = await aSessionFor(account.id);
    expect(() => requireEditor(null)).toThrow();

    await setRole(database, account.id, "super_admin");
    const promoted = await verifySession(database, token);
    expect(() => requireEditor(promoted)).not.toThrow();
  });

  it("refuses to manage the owner account through this surface", async () => {
    const [owner] = await db
      .insert(accounts)
      .values({ email: "owner@example.com", passwordHash: "x", status: "approved", role: "owner" })
      .returning();
    await expect(approve(database, owner.id, "viewer")).rejects.toThrow(NotFound);
    await expect(reject(database, owner.id)).rejects.toThrow(NotFound);
  });

  it("refuses an account that does not exist", async () => {
    await expect(approve(database, 9_999, "viewer")).rejects.toThrow(NotFound);
  });
});

describe("rejecting", () => {
  it("ends a live session immediately rather than at expiry", async () => {
    const account = await anAccount("stranger@example.com", "approved", "super_admin");
    const token = await aSessionFor(account.id);
    expect(await verifySession(database, token)).not.toBeNull();

    await reject(database, account.id);

    expect(await verifySession(database, token)).toBeNull();
    const [row] = await db.select().from(accounts).where(eq(accounts.id, account.id));
    expect(row.status).toBe("rejected");
    expect(row.role).toBeNull();
  });
});

describe("only the owner may administer accounts", () => {
  it("refuses a super-admin the owner powers", async () => {
    const account = await anAccount("brother@example.com", "approved", "super_admin");
    const actor = await verifySession(database, await aSessionFor(account.id));
    expect(() => requireOwner(actor)).toThrow();
  });
});

describe("the owner resets a forgotten password", () => {
  it("sets a new one and ends that account's sessions", async () => {
    const account = await anAccount("father@example.com", "approved", "viewer");
    const token = await aSessionFor(account.id);

    await resetPassword(database, account.id, "a-brand-new-long-password");

    const [row] = await db.select().from(accounts).where(eq(accounts.id, account.id));
    expect(await verifyPassword(row.passwordHash, "a-brand-new-long-password")).toBe(true);
    expect(await verifySession(database, token)).toBeNull();
  });

  it("refuses a replacement password that is too short", async () => {
    const account = await anAccount("father@example.com", "approved", "viewer");
    await expect(resetPassword(database, account.id, "short")).rejects.toThrow();
  });
});
