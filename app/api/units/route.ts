import { record } from "@/data/audit";
import { requireApproved, requireEditor } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { createUnit, listUnits } from "@/data/property";
import { db } from "@/db/client";

export async function GET() {
  try {
    requireApproved(await currentActor());
    return Response.json({ units: await listUnits(db) });
  } catch (error) {
    return toResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = requireEditor(await currentActor());
    const body = (await request.json()) as { label?: unknown; floor?: unknown };
    if (typeof body.label !== "string" || body.label.trim() === "") {
      return Response.json({ error: "A unit needs a name." }, { status: 400 });
    }
    const unit = await createUnit(db, body.label, typeof body.floor === "string" ? body.floor : "");
    await record(db, actor, "unit.created", unit.label, unit.floor);
    return Response.json({ unit }, { status: 201 });
  } catch (error) {
    return toResponse(error);
  }
}
