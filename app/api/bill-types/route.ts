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
    requireEditor(await currentActor());
    const body = (await request.json()) as { name?: unknown };
    if (typeof body.name !== "string" || body.name.trim() === "") {
      return Response.json({ error: "A bill needs a name." }, { status: 400 });
    }
    return Response.json({ billType: await createBillType(db, body.name) }, { status: 201 });
  } catch (error) {
    return toResponse(error);
  }
}
