import { record } from "@/data/audit";
import { requireApproved, requireEditor } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { deleteTenant, tenantHistory, updateTenant } from "@/data/property";
import { db } from "@/db/client";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireApproved(await currentActor());
    return Response.json(await tenantHistory(db, Number((await context.params).id)));
  } catch (error) {
    return toResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = requireEditor(await currentActor());
    const id = Number((await context.params).id);
    const body = (await request.json()) as { name?: string; phone?: string; notes?: string };
    const tenant = await updateTenant(db, id, body);
    await record(db, actor, "tenant.updated", tenant.name, Object.keys(body).join(", "));
    return Response.json({ tenant });
  } catch (error) {
    return toResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = requireEditor(await currentActor());
    const id = Number((await context.params).id);
    const { tenant } = await tenantHistory(db, id);
    await deleteTenant(db, id);
    await record(db, actor, "tenant.removed", tenant.name);
    return Response.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
