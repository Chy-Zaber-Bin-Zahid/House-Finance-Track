import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { accounts } from "@/db/schema";
import { testDb, acquireSuiteLock, releaseSuiteLock, truncateAll } from "@/test/db";
import type { Database } from "@/db/client";
import { findByEmail, register, setPassword, signIn } from "./accounts";
import { MIN_PASSWORD_LENGTH, WeakPassword, hashPassword, verifyPassword } from "./passwords";
import { clearAllWindows } from "./rate-limit";
import { verifySession } from "./session";

const { db, close } = testDb();
const database = db as unknown as Database;
const GOOD = "a-long-enough-password";
const ADDRESS = "127.0.0.1";

beforeAll(async () => {
  await acquireSuiteLock(db);
});

beforeEach(async () => {
  await truncateAll(db);
  clearAllWindows();
});

afterAll(async () => {
  await releaseSuiteLock(db);
  await close();
});

async function anApprovedAccount(email = "brother@example.com") {
  await db.insert(accounts).values({
    email,
    passwordHash: await hashPassword(GOOD),
    status: "approved",
    role: "super_admin",
  });
}

describe("password storage", () => {
  it("stores a verifiable argon2id hash, never the password", async () => {
    const hash = await hashPassword(GOOD);
    expect(hash).toContain("$argon2id$");
    expect(hash).not.toContain(GOOD);
    expect(await verifyPassword(hash, GOOD)).toBe(true);
    expect(await verifyPassword(hash, "wrong-password-entirely")).toBe(false);
  });

  it("refuses a password too short to be worth hashing", async () => {
    await expect(hashPassword("short")).rejects.toThrow(WeakPassword);
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(12);
  });
});

describe("signing in", () => {
  it("issues a session an approved account can use", async () => {
    await anApprovedAccount();
    const result = await signIn(database, "brother@example.com", GOOD, ADDRESS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((await verifySession(database, result.token))?.email).toBe("brother@example.com");
  });

  it("gives the same refusal for a wrong password and an unknown email", async () => {
    await anApprovedAccount();
    const wrong = await signIn(database, "brother@example.com", "definitely-not-it", ADDRESS);
    const unknown = await signIn(database, "nobody@example.com", GOOD, ADDRESS);
    expect(wrong).toEqual({ ok: false, reason: "invalid" });
    expect(unknown).toEqual({ ok: false, reason: "invalid" });
  });

  it("tells an awaiting account it is waiting, but only after a correct password", async () => {
    await db.insert(accounts).values({
      email: "father@example.com",
      passwordHash: await hashPassword(GOOD),
      status: "awaiting",
      role: null,
    });

    expect(await signIn(database, "father@example.com", GOOD, ADDRESS)).toEqual({
      ok: false,
      reason: "awaiting",
    });
    expect(await signIn(database, "father@example.com", "wrong-password-here", ADDRESS)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("tells a rejected account it was rejected", async () => {
    await db.insert(accounts).values({
      email: "stranger@example.com",
      passwordHash: await hashPassword(GOOD),
      status: "rejected",
      role: null,
    });
    expect(await signIn(database, "stranger@example.com", GOOD, ADDRESS)).toEqual({
      ok: false,
      reason: "rejected",
    });
  });

  it("is case-insensitive about the email", async () => {
    await anApprovedAccount();
    const result = await signIn(database, "  Brother@Example.COM ", GOOD, ADDRESS);
    expect(result.ok).toBe(true);
  });

  it("throttles repeated failures for one email", async () => {
    await anApprovedAccount();
    for (let i = 0; i < 5; i += 1) {
      expect((await signIn(database, "brother@example.com", "wrong-password", ADDRESS)).ok).toBe(false);
    }
    expect(await signIn(database, "brother@example.com", GOOD, ADDRESS)).toEqual({
      ok: false,
      reason: "throttled",
    });
  });

  it("clears the failure count after a success", async () => {
    await anApprovedAccount();
    await signIn(database, "brother@example.com", "wrong-password", ADDRESS);
    expect((await signIn(database, "brother@example.com", GOOD, ADDRESS)).ok).toBe(true);
    await signIn(database, "brother@example.com", "wrong-password", ADDRESS);
    expect((await signIn(database, "brother@example.com", GOOD, ADDRESS)).ok).toBe(true);
  });
});

describe("registering", () => {
  it("creates an account that cannot sign in yet", async () => {
    await register(database, "father@example.com", GOOD);
    const account = await findByEmail(database, "father@example.com");
    expect(account?.status).toBe("awaiting");
    expect(account?.role).toBeNull();
    expect(await signIn(database, "father@example.com", GOOD, ADDRESS)).toEqual({
      ok: false,
      reason: "awaiting",
    });
  });

  it("refuses a password too short", async () => {
    await expect(register(database, "father@example.com", "short")).rejects.toThrow(WeakPassword);
    expect(await findByEmail(database, "father@example.com")).toBeNull();
  });

  it("does not disclose that an address is already registered", async () => {
    await anApprovedAccount();
    await expect(register(database, "brother@example.com", GOOD)).resolves.toBeUndefined();
    const rows = await db.select().from(accounts).where(eq(accounts.email, "brother@example.com"));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("approved");
  });
});

describe("changing a password", () => {
  it("stops the old password working", async () => {
    await anApprovedAccount();
    const account = await findByEmail(database, "brother@example.com");
    await setPassword(database, account!.id, "a-different-long-password");

    expect(await signIn(database, "brother@example.com", GOOD, ADDRESS)).toEqual({
      ok: false,
      reason: "invalid",
    });
    clearAllWindows();
    expect((await signIn(database, "brother@example.com", "a-different-long-password", ADDRESS)).ok).toBe(true);
  });
});

describe("a limit that cannot tell callers apart", () => {
  /*
   * `addressOf` returns null when no proxy depth is declared, which is the
   * default. Keying the per-address limit on a stand-in string put every
   * caller in one bucket, so twenty failures from a stranger locked the whole
   * household out of sign-in — the limit denying service instead of defending
   * against it.
   */
  it("never lets one caller's failures lock out another", async () => {
    await anApprovedAccount();

    for (let i = 0; i < 25; i += 1) {
      await signIn(database, `stranger${i}@example.com`, "wrong-password", null);
    }

    expect((await signIn(database, "brother@example.com", GOOD, null)).ok).toBe(true);
  });

  it("still limits by address where the deployment can tell callers apart", async () => {
    await anApprovedAccount();

    /* Twenty failures spread over emails, so only the address count is spent. */
    for (let i = 0; i < 20; i += 1) {
      await signIn(database, `stranger${i}@example.com`, "wrong-password", "203.0.113.7");
    }

    expect(await signIn(database, "brother@example.com", GOOD, "203.0.113.7")).toEqual({
      ok: false,
      reason: "throttled",
    });
    /* Another address is untouched by it. */
    expect((await signIn(database, "brother@example.com", GOOD, "203.0.113.8")).ok).toBe(true);
  });

  it("clears the address count too when someone proves who they are", async () => {
    await anApprovedAccount();

    for (let i = 0; i < 19; i += 1) {
      await signIn(database, `stranger${i}@example.com`, "wrong-password", ADDRESS);
    }
    expect((await signIn(database, "brother@example.com", GOOD, ADDRESS)).ok).toBe(true);

    /* Nineteen more would have passed the old ceiling had the success not reset it. */
    for (let i = 0; i < 19; i += 1) {
      await signIn(database, `other${i}@example.com`, "wrong-password", ADDRESS);
    }
    expect((await signIn(database, "brother@example.com", GOOD, ADDRESS)).ok).toBe(true);
  });
});
