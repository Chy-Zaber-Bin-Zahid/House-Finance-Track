import { requireApproved, requireEditor } from "@/data/guard";
import { openDocument, removeDocument } from "@/data/files";
import { currentActor, toResponse } from "@/data/http";
import { db } from "@/db/client";

/** Every read re-enters the guard; no bucket URL is ever handed out. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireApproved(await currentActor());
    const id = Number((await context.params).id);
    if (!Number.isInteger(id)) return Response.json({ error: "No such file." }, { status: 400 });

    const { stream, headers } = await openDocument(db, id);
    return new Response(stream, { headers });
  } catch (error) {
    return toResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireEditor(await currentActor());
    await removeDocument(db, Number((await context.params).id));
    return Response.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
