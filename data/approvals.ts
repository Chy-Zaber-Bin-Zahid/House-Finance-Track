import { desc, eq, isNull, ne, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import { accounts } from "@/db/schema";
import { NotFound } from "./errors";
import { hashPassword } from "./passwords";
import { destroyOtherSessions } from "./session";
import { sessions } from "@/db/schema";

export type ManagedAccount = {
  id: number;
  email: string;
  status: "awaiting" | "approved" | "rejected";
  role: "owner" | "super_admin" | "viewer" | null;
  createdAt: Date;
};

/**
 * Everyone but the owner, newest first. Resolved accounts stay listed rather
 * than vanishing, so the owner can see who has access and change it later —
 * the list is the access-control screen, not just an inbox.
 */
export async function listAccounts(db: Database): Promise<ManagedAccount[]> {
  return db
    .select({
      id: accounts.id,
      email: accounts.email,
      status: accounts.status,
      role: accounts.role,
      createdAt: accounts.createdAt,
    })
    .from(accounts)
    /*
     * An awaiting account has no role yet, and `role <> 'owner'` is NULL rather
     * than true for those - which would hide from this list exactly the people
     * it exists to show.
     */
    .where(or(isNull(accounts.role), ne(accounts.role, "owner")))
    .orderBy(desc(accounts.createdAt));
}

async function loadManageable(db: Database, id: number) {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  if (!account) throw new NotFound("No such account.");
  if (account.role === "owner") throw new NotFound("The owner account cannot be managed here.");
  return account;
}

export async function approve(
  db: Database,
  id: number,
  role: "super_admin" | "viewer",
): Promise<void> {
  const account = await loadManageable(db, id);
  await db.update(accounts).set({ status: "approved", role }).where(eq(accounts.id, account.id));
}

export async function reject(db: Database, id: number): Promise<void> {
  const account = await loadManageable(db, id);
  await db.update(accounts).set({ status: "rejected", role: null }).where(eq(accounts.id, account.id));
  /* Rejecting someone who is signed in should take effect now, not at expiry. */
  await db.delete(sessions).where(eq(sessions.accountId, account.id));
}

export async function setRole(
  db: Database,
  id: number,
  role: "super_admin" | "viewer",
): Promise<void> {
  const account = await loadManageable(db, id);
  await db.update(accounts).set({ role }).where(eq(accounts.id, account.id));
}

/**
 * The owner sets a new password for someone who has forgotten theirs.
 *
 * Scope Boundaries defers email and says a forgotten password is reset by the
 * owner; without this that promise has no mechanism behind it and recovery
 * means hand-editing a hash in Postgres.
 */
export async function resetPassword(db: Database, id: number, password: string): Promise<void> {
  const account = await loadManageable(db, id);
  const passwordHash = await hashPassword(password);
  await db.update(accounts).set({ passwordHash }).where(eq(accounts.id, account.id));
  await destroyOtherSessions(db, account.id, "");
}
