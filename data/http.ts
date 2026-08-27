import { cookies } from "next/headers";
import { db } from "@/db/client";
import { AccessDenied, NotFound, StillReferenced } from "./errors";
import { verifySession, type Actor } from "./session";

export const SESSION_COOKIE = "house_session";

/** Route handlers read the cookie here and hand the token to the data layer. */
export async function currentActor(): Promise<Actor | null> {
  const jar = await cookies();
  return verifySession(db, jar.get(SESSION_COOKIE)?.value);
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

const DENIAL_STATUS: Record<AccessDenied["reason"], number> = {
  "signed-out": 401,
  "awaiting-approval": 403,
  rejected: 403,
  "read-only": 403,
  "owner-only": 403,
  "year-locked": 409,
};

/**
 * Turns a data-layer refusal into a response. Anything not deliberately
 * refused becomes a bare 500 rather than leaking its reason to the caller.
 */
export function toResponse(error: unknown): Response {
  if (error instanceof AccessDenied) {
    return Response.json(
      { error: error.message, reason: error.reason },
      { status: DENIAL_STATUS[error.reason] },
    );
  }
  if (error instanceof NotFound) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof StillReferenced) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  console.error(error);
  return Response.json({ error: "Something went wrong." }, { status: 500 });
}

/**
 * The caller's address, for rate limiting.
 *
 * `x-forwarded-for` is written by the client, and a proxy appends rather than
 * replaces - so the first element is whatever the caller put there. Reading it
 * blindly lets anyone mint a fresh rate-limit bucket per request. Only the hops
 * a deployment actually declares are trusted; with none declared the header is
 * ignored entirely.
 */
export function addressOf(request: Request): string {
  const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? "0");
  if (!Number.isInteger(hops) || hops < 1) return "direct";

  const chain = request.headers.get("x-forwarded-for")?.split(",").map((p) => p.trim()) ?? [];
  return chain.at(-hops) || "direct";
}
