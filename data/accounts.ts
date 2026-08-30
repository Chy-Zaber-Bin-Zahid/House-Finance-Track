import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { accounts, sessions } from "@/db/schema";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword, WeakPassword } from "./passwords";
import {
  consume,
  consumePerCaller,
  reset,
  resetPerCaller,
  SIGN_IN_PER_ADDRESS,
  SIGN_IN_PER_EMAIL,
} from "./rate-limit";
import { createSessionToken, hashToken, sessionExpiry } from "./session";

/**
 * A hash to verify against when no account matches, so an unknown email costs
 * the same time as a wrong password and cannot be used to enumerate accounts.
 */
const DECOY_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHR2YWx1ZQ$Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFy";

export type SignInFailure = "invalid" | "awaiting" | "rejected" | "throttled";

export type SignInResult =
  | { ok: true; token: string; accountId: number }
  | { ok: false; reason: SignInFailure };

/**
 * The password is checked before the account's status is considered. Reporting
 * "waiting to be approved" to anyone who types an email would turn this
 * endpoint into a way to discover who has an account here.
 */
export async function signIn(
  db: Database,
  email: string,
  password: string,
  address: string | null,
): Promise<SignInResult> {
  const normalised = email.trim().toLowerCase();

  if (!consume(`signin:email:${normalised}`, SIGN_IN_PER_EMAIL)) return { ok: false, reason: "throttled" };
  if (!consumePerCaller("signin:addr", address, SIGN_IN_PER_ADDRESS)) {
    return { ok: false, reason: "throttled" };
  }

  const [account] = await db.select().from(accounts).where(eq(accounts.email, normalised)).limit(1);

  const correct = await verifyPassword(account?.passwordHash ?? DECOY_HASH, password);
  if (!account || !correct) return { ok: false, reason: "invalid" };

  if (account.status === "awaiting") return { ok: false, reason: "awaiting" };
  if (account.status === "rejected") return { ok: false, reason: "rejected" };

  const token = createSessionToken();
  await db.insert(sessions).values({
    id: hashToken(token),
    accountId: account.id,
    expiresAt: sessionExpiry(),
  });

  /* Both counts, not just the email's: someone who just proved who they are has
   * not been attacking the address they arrived from. */
  reset(`signin:email:${normalised}`);
  resetPerCaller("signin:addr", address);
  return { ok: true, token, accountId: account.id };
}

/** Creates an account that cannot sign in until the owner approves it. */
export async function register(db: Database, email: string, password: string): Promise<void> {
  const normalised = email.trim().toLowerCase();

  /*
   * Cheap checks first. Hashing costs 64 MB and tens of milliseconds, and this
   * endpoint is open to the internet - paying that before knowing whether the
   * work is needed turns registration into a memory-exhaustion lever.
   */
  if (password.length < MIN_PASSWORD_LENGTH) throw new WeakPassword();

  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.email, normalised))
    .limit(1);
  /*
   * A duplicate registration succeeds silently rather than reporting that the
   * address is taken, for the same reason sign-in gives one refusal: the
   * endpoint is open to anyone and should not disclose who has an account.
   */
  if (existing.length > 0) return;

  const passwordHash = await hashPassword(password);
  await db.insert(accounts).values({ email: normalised, passwordHash, status: "awaiting", role: null });
}

export async function setPassword(db: Database, accountId: number, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  await db.update(accounts).set({ passwordHash }).where(eq(accounts.id, accountId));
}

export async function findByEmail(db: Database, email: string) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, email.trim().toLowerCase()))
    .limit(1);
  return account ?? null;
}

/**
 * Replaces a password only when the current one is given correctly. Lives here
 * rather than in the route so the route stays a thin wrapper and no endpoint
 * builds its own query.
 */
export async function changePassword(
  db: Database,
  accountId: number,
  current: string,
  next: string,
): Promise<boolean> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account || !(await verifyPassword(account.passwordHash, current))) return false;
  await setPassword(db, accountId, next);
  return true;
}
