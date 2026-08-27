import { requireEditor } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { deleteBillType, renameBillType, setBillTypeActive } from "@/data/ledger";
import { db } from "@/db/client";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireEditor(await currentActor());
    const id = Number((await context.params).id);
    const body = (await request.json()) as { name?: unknown; active?: unknown };

    if (typeof body.name === "string") {
      return Response.json({ billType: await renameBillType(db, id, body.name) });
    }
    if (typeof body.active === "boolean") {
      return Response.json({ billType: await setBillTypeActive(db, id, body.active) });
    }
    return Response.json({ error: "Nothing to change." }, { status: 400 });
  } catch (error) {
    return toResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireEditor(await currentActor());
    await deleteBillType(db, Number((await context.params).id));
    return Response.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
