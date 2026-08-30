import { cookies } from "next/headers";
import { db } from "@/db/client";
import { AccessDenied, NotFound, StillReferenced } from "./errors";
import { UploadTooLarge } from "./files";
import { WeakPassword } from "./passwords";
import { BackwardsPeriod } from "./period";
import { OverlappingTenancy, RentChangeOutsideTenancy } from "./property";
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
 * Turns a data-layer refusal into a response. Every deliberate refusal in the
 * app maps here, in one place — a route that grows a new domain error gets the
 * right status without each handler remembering to catch it, and the mapping
 * cannot drift between twenty copies.
 *
 * Anything not deliberately refused becomes a bare 500 rather than leaking its
 * reason to the caller.
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
  if (error instanceof StillReferenced || error instanceof OverlappingTenancy) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  if (
    error instanceof WeakPassword ||
    error instanceof BackwardsPeriod ||
    error instanceof RentChangeOutsideTenancy
  ) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof UploadTooLarge) {
    return Response.json({ error: error.message }, { status: 413 });
  }
  console.error(error);
  return Response.json({ error: "Something went wrong." }, { status: 500 });
}

/**
 * The caller's address, for rate limiting — or `null` when this deployment has
 * no way to tell callers apart.
 *
 * `x-forwarded-for` is written by the client, and a proxy appends rather than
 * replaces - so the first element is whatever the caller put there. Reading it
 * blindly lets anyone mint a fresh rate-limit bucket per request. Only the hops
 * a deployment actually declares are trusted; with none declared the header is
 * ignored entirely.
 *
 * `null` rather than a stand-in string. A stand-in is a perfectly good map key,
 * so every caller shared one bucket and "five tries each" quietly became "five
 * tries between everyone" — which a stranger could spend in seconds to lock the
 * whole household out of sign-in.
 */
export function addressOf(request: Request): string | null {
  const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? "0");
  if (!Number.isInteger(hops) || hops < 1) return null;

  const chain = request.headers.get("x-forwarded-for")?.split(",").map((p) => p.trim()) ?? [];
  return chain.at(-hops) || null;
}
