import { setPassword } from "@/data/accounts";
import { requireApproved } from "@/data/guard";
import { currentActor, sessionToken, toResponse } from "@/data/http";
import { WeakPassword } from "@/data/passwords";
import { consume, PASSWORD_CHANGE_PER_ACCOUNT } from "@/data/rate-limit";
import { destroyOtherSessions, hashToken, verifySession } from "@/data/session";
import { db } from "@/db/client";
import { accounts } from "@/db/schema";
import { verifyPassword } from "@/data/passwords";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const actor = requireApproved(await currentActor());
    const body = (await request.json()) as { current?: unknown; next?: unknown };
    if (typeof body.current !== "string" || typeof body.next !== "string") {
      return Response.json({ error: "Both passwords are required." }, { status: 400 });
    }

    if (!consume(`password:${actor.accountId}`, PASSWORD_CHANGE_PER_ACCOUNT)) {
      return Response.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
    }

    const [account] = await db.select().from(accounts).where(eq(accounts.id, actor.accountId)).limit(1);
    if (!account || !(await verifyPassword(account.passwordHash, body.current))) {
      return Response.json({ error: "That is not your current password." }, { status: 403 });
    }

    await setPassword(db, actor.accountId, body.next);

    /*
     * Changing a password because someone may have got in is pointless if their
     * session survives it. Every other session for this account ends here.
     */
    const token = await sessionToken();
    await destroyOtherSessions(db, actor.accountId, hashToken(token ?? ""));

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof WeakPassword) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return toResponse(error);
  }
}
