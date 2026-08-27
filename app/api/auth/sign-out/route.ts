import { clearSessionCookie, sessionToken, toResponse } from "@/data/http";
import { destroySession } from "@/data/session";
import { db } from "@/db/client";

export async function POST() {
  try {
    await destroySession(db, await sessionToken());
    await clearSessionCookie();
    return Response.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
