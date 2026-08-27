import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Database } from "@/db/client";
import { accounts, sessions } from "@/db/schema";

/** How long a session lasts, absolute. The row's expiry is authoritative. */
export const SESSION_DAYS = 14;

/**
 * Who is making this request, read fresh from the database every time.
 *
 * Role and status are re-read rather than trusted from the cookie, so an
 * account the owner rejects or demotes loses that access on its very next
 * request instead of when its session happens to expire.
 */
export type Actor = {
  accountId: number;
  email: string;
  role: "owner" | "super_admin" | "viewer" | null;
  status: "awaiting" | "approved" | "rejected";
  sessionId: string;
  /** The one past year this session may write to, if its holder unlocked one. */
  unlockedYear: number | null;
};

/** A token with enough entropy that guessing one is not a strategy. */
export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * What the sessions table stores. A leaked database dump then yields nothing
 * that can be replayed as a session.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Resolve the caller from a session token, or null when there is no live
 * session behind it.
 *
 * The token is a parameter rather than something this function reads for
 * itself: cookie access is request-scoped and throws outside a request, and
 * this is the one function whose refusals most need to be testable.
 */
export async function verifySession(db: Database, token: string | undefined): Promise<Actor | null> {
  if (!token) return null;

  const id = hashToken(token);
  const rows = await db
    .select({
      sessionId: sessions.id,
      unlockedYear: sessions.unlockedYear,
      accountId: accounts.id,
      email: accounts.email,
      role: accounts.role,
      status: accounts.status,
    })
    .from(sessions)
    .innerJoin(accounts, eq(accounts.id, sessions.accountId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Drops sessions whose expiry has passed. `verifySession` already refuses them,
 * so this is housekeeping rather than a control — without it the table only
 * ever grows.
 */
export async function purgeExpiredSessions(db: Database): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export async function destroySession(db: Database, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

/** Ends every other session for an account — used when its password changes. */
export async function destroyOtherSessions(
  db: Database,
  accountId: number,
  keepSessionId: string,
): Promise<void> {
  const rows = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.accountId, accountId));
  for (const row of rows) {
    if (row.id !== keepSessionId) await db.delete(sessions).where(eq(sessions.id, row.id));
  }
}
