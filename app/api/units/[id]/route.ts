import { requireEditor } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { deleteUnit, updateUnit } from "@/data/property";
import { db } from "@/db/client";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireEditor(await currentActor());
    const id = Number((await context.params).id);
    const body = (await request.json()) as { label?: string; floor?: string };
    return Response.json({ unit: await updateUnit(db, id, body) });
  } catch (error) {
    return toResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireEditor(await currentActor());
    await deleteUnit(db, Number((await context.params).id));
    return Response.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
