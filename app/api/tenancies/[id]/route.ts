import { requireEditor } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { deleteTenancy, endTenancy } from "@/data/property";
import { db } from "@/db/client";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = requireEditor(await currentActor());
    const id = Number((await context.params).id);
    const body = (await request.json()) as { end?: { year?: number; month?: number } };
    if (typeof body.end?.year !== "number" || typeof body.end?.month !== "number") {
      return Response.json({ error: "An end month is required." }, { status: 400 });
    }
    const ended = await endTenancy(db, id, { year: body.end.year, month: body.end.month }, actor);
    return Response.json({ ended: { id: ended.id } });
  } catch (error) {
    return toResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = requireEditor(await currentActor());
    await deleteTenancy(db, Number((await context.params).id), actor);
    return Response.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
