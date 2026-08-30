import { requireEditor } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { record } from "@/data/audit";
import { deleteBillType, listBillTypes, renameBillType, setBillTypeActive } from "@/data/ledger";
import { db } from "@/db/client";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = requireEditor(await currentActor());
    const id = Number((await context.params).id);
    const body = (await request.json()) as { name?: unknown; active?: unknown };

    if (typeof body.name === "string") {
      const billType = await renameBillType(db, id, body.name);
      await record(db, actor, "billType.renamed", billType.name);
      return Response.json({ billType });
    }
    if (typeof body.active === "boolean") {
      const billType = await setBillTypeActive(db, id, body.active);
      await record(
        db,
        actor,
        body.active ? "billType.restored" : "billType.retired",
        billType.name,
      );
      return Response.json({ billType });
    }
    return Response.json({ error: "Nothing to change." }, { status: 400 });
  } catch (error) {
    return toResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = requireEditor(await currentActor());
    const id = Number((await context.params).id);
    const existing = (await listBillTypes(db)).find((b) => b.id === id);
    await deleteBillType(db, id);
    await record(db, actor, "billType.removed", existing?.name ?? `Bill #${id}`);
    return Response.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
