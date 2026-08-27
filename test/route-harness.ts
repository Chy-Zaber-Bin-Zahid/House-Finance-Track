import { accounts, sessions } from "@/db/schema";
import { createSessionToken, hashToken, sessionExpiry } from "@/data/session";
import { hashPassword } from "@/data/passwords";
import { db } from "@/db/client";

/**
 * Lets a test call a real route handler.
 *
 * Everything below the routes was already covered; the wiring between an HTTP
 * request and the data layer was not — which meant a handler could pass the
 * wrong argument to a guard, or drop a validation branch, with every test green.
 */

/** The cookie jar the mocked `next/headers` reads from. */
export const jar = new Map<string, string>();

export function signedOut(): void {
  jar.clear();
}

export type TestRole = "owner" | "super_admin" | "viewer";

export async function signedInAs(
  role: TestRole,
  options: { status?: "awaiting" | "approved" | "rejected"; unlockedYear?: number } = {},
): Promise<{ accountId: number; token: string }> {
  const [account] = await db
    .insert(accounts)
    .values({
      email: `${role}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      passwordHash: await hashPassword("a-long-enough-password"),
      status: options.status ?? "approved",
      role,
    })
    .returning();

  const token = createSessionToken();
  await db.insert(sessions).values({
    id: hashToken(token),
    accountId: account.id,
    expiresAt: sessionExpiry(),
    unlockedYear: options.unlockedYear ?? null,
  });

  jar.clear();
  jar.set("house_session", token);
  return { accountId: account.id, token };
}

export function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Next 16 hands route handlers a promise for their params. */
export function params<T extends Record<string, string>>(value: T) {
  return { params: Promise.resolve(value) };
}
