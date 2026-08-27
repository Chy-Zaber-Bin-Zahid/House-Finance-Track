import { requireEditor } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { deleteTenancy, endTenancy, OverlappingTenancy } from "@/data/property";
import { BackwardsPeriod } from "@/data/period";
import { db } from "@/db/client";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireEditor(await currentActor());
    const id = Number((await context.params).id);
    const body = (await request.json()) as { end?: { year?: number; month?: number } };
    if (typeof body.end?.year !== "number" || typeof body.end?.month !== "number") {
      return Response.json({ error: "An end month is required." }, { status: 400 });
    }
    return Response.json({ tenancy: await endTenancy(db, id, { year: body.end.year, month: body.end.month }) });
  } catch (error) {
    if (error instanceof BackwardsPeriod) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof OverlappingTenancy) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return toResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireEditor(await currentActor());
    await deleteTenancy(db, Number((await context.params).id));
    return Response.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
