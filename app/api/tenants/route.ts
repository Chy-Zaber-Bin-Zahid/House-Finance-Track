import { requireApproved, requireEditor } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { createTenant, listTenants } from "@/data/property";
import { db } from "@/db/client";

export async function GET() {
  try {
    requireApproved(await currentActor());
    return Response.json({ tenants: await listTenants(db) });
  } catch (error) {
    return toResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireEditor(await currentActor());
    const body = (await request.json()) as { name?: unknown; phone?: unknown };
    if (typeof body.name !== "string" || body.name.trim() === "") {
      return Response.json({ error: "A tenant needs a name." }, { status: 400 });
    }
    const tenant = await createTenant(db, body.name, typeof body.phone === "string" ? body.phone : "");
    return Response.json({ tenant }, { status: 201 });
  } catch (error) {
    return toResponse(error);
  }
}
