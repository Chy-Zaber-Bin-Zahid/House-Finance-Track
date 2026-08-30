import { record } from "@/data/audit";
import { requireApproved, requireEditor } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { createBillType, listBillTypes } from "@/data/ledger";
import { db } from "@/db/client";

export async function GET() {
  try {
    requireApproved(await currentActor());
    return Response.json({ billTypes: await listBillTypes(db) });
  } catch (error) {
    return toResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = requireEditor(await currentActor());
    const body = (await request.json()) as { name?: unknown };
    if (typeof body.name !== "string" || body.name.trim() === "") {
      return Response.json({ error: "A bill needs a name." }, { status: 400 });
    }
    const billType = await createBillType(db, body.name);
    await record(db, actor, "billType.created", billType.name);
    return Response.json({ billType }, { status: 201 });
  } catch (error) {
    return toResponse(error);
  }
}
