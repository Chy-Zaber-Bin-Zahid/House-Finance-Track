import { readAuditLog } from "@/data/audit";
import { requireOwner } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { db } from "@/db/client";

/**
 * The trail, newest first.
 *
 * Guarded here as well as in `readAuditLog`. The data layer is the boundary
 * that counts, but every sibling handler states its own rule, and a rule you
 * cannot see in the handler is one the next person will forget to add.
 */
export async function GET(request: Request) {
  try {
    const actor = requireOwner(await currentActor());

    const params = new URL(request.url).searchParams;
    const before = Number(params.get("before"));
    const actorEmail = params.get("actor") ?? undefined;

    return Response.json(
      await readAuditLog(db, actor, {
        before: Number.isInteger(before) && before > 0 ? before : undefined,
        actorEmail: actorEmail || undefined,
      }),
    );
  } catch (error) {
    return toResponse(error);
  }
}
