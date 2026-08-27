import { requireApproved, requireEditor } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { createTenancy, listTenancies, OverlappingTenancy } from "@/data/property";
import { db } from "@/db/client";

type Month = { year: number; month: number };

function isMonth(value: unknown): value is Month {
  const m = value as Month;
  return (
    typeof m?.year === "number" &&
    typeof m?.month === "number" &&
    m.month >= 1 &&
    m.month <= 12
  );
}

export async function GET() {
  try {
    requireApproved(await currentActor());
    return Response.json({ tenancies: await listTenancies(db) });
  } catch (error) {
    return toResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireEditor(await currentActor());
    const body = (await request.json()) as {
      unitId?: unknown;
      tenantId?: unknown;
      start?: unknown;
      end?: unknown;
      expectedRent?: unknown;
    };

    if (
      typeof body.unitId !== "number" ||
      typeof body.tenantId !== "number" ||
      !isMonth(body.start) ||
      (body.end !== null && !isMonth(body.end))
    ) {
      return Response.json({ error: "A tenancy needs a unit, a tenant, and a start month." }, { status: 400 });
    }

    const tenancy = await createTenancy(db, {
      unitId: body.unitId,
      tenantId: body.tenantId,
      start: body.start,
      end: (body.end as Month | null) ?? null,
      expectedRent: typeof body.expectedRent === "number" ? body.expectedRent : 0,
    });
    return Response.json({ tenancy }, { status: 201 });
  } catch (error) {
    if (error instanceof OverlappingTenancy) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return toResponse(error);
  }
}
