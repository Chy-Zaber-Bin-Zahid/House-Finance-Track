import { requireEditor } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { record } from "@/data/audit";
import { deleteUnit, listUnits, updateUnit } from "@/data/property";
import { db } from "@/db/client";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = requireEditor(await currentActor());
    const id = Number((await context.params).id);
    const body = (await request.json()) as { label?: string; floor?: string };
    const unit = await updateUnit(db, id, body);
    await record(db, actor, "unit.renamed", unit.label, `Now on ${unit.floor}`);
    return Response.json({ unit });
  } catch (error) {
    return toResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = requireEditor(await currentActor());
    const id = Number((await context.params).id);
    /* Named before it goes, or the line records an id nobody can look up. */
    const [existing] = await listUnits(db).then((all) => all.filter((u) => u.id === id));
    await deleteUnit(db, id);
    await record(db, actor, "unit.removed", existing?.label ?? `Unit #${id}`);
    return Response.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
