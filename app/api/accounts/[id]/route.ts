import { approve, reject, resetPassword, setRole } from "@/data/approvals";
import { accountEmail, record } from "@/data/audit";
import { requireOwner } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { db } from "@/db/client";

type Body = {
  action?: "approve" | "reject" | "set-role" | "reset-password";
  role?: "super_admin" | "viewer";
  password?: string;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = requireOwner(await currentActor());

    const id = Number((await context.params).id);
    if (!Number.isInteger(id)) return Response.json({ error: "Unknown account." }, { status: 400 });

    const body = (await request.json()) as Body;
    /* Read before the change: rejecting an account does not remove it, but a
     * later action might, and the line has to name who it was about. */
    const subject = await accountEmail(db, id);

    switch (body.action) {
      case "approve":
        if (body.role !== "super_admin" && body.role !== "viewer") {
          return Response.json({ error: "Choose a role." }, { status: 400 });
        }
        await approve(db, id, body.role);
        await record(db, actor, "account.approved", subject, `As ${body.role}`);
        break;
      case "reject":
        await reject(db, id);
        await record(db, actor, "account.rejected", subject);
        break;
      case "set-role":
        if (body.role !== "super_admin" && body.role !== "viewer") {
          return Response.json({ error: "Choose a role." }, { status: 400 });
        }
        await setRole(db, id, body.role);
        await record(db, actor, "account.role_changed", subject, `Now ${body.role}`);
        break;
      case "reset-password":
        if (typeof body.password !== "string") {
          return Response.json({ error: "A new password is required." }, { status: 400 });
        }
        await resetPassword(db, id, body.password);
        await record(db, actor, "account.password_changed", subject, "Reset by the owner");
        break;
      default:
        return Response.json({ error: "Unknown action." }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
