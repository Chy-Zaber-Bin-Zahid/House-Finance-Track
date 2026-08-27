import { signIn } from "@/data/accounts";
import { addressOf, setSessionCookie, toResponse } from "@/data/http";
import { sessionExpiry } from "@/data/session";
import { db } from "@/db/client";

const MESSAGES = {
  invalid: "That email and password do not match.",
  awaiting: "This account is waiting to be approved.",
  rejected: "This account was not approved.",
  throttled: "Too many attempts. Try again in a few minutes.",
} as const;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    if (typeof body.email !== "string" || typeof body.password !== "string") {
      return Response.json({ error: "Email and password are required." }, { status: 400 });
    }

    const result = await signIn(db, body.email, body.password, addressOf(request));
    if (!result.ok) {
      const status = result.reason === "throttled" ? 429 : result.reason === "invalid" ? 401 : 403;
      return Response.json({ error: MESSAGES[result.reason], reason: result.reason }, { status });
    }

    await setSessionCookie(result.token, sessionExpiry());
    return Response.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
