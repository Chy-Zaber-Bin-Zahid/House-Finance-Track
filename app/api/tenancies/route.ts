import { monthLabel, record } from "@/data/audit";
import { requireApproved, requireEditor } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { createTenancy, listTenancies } from "@/data/property";
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
    const actor = requireEditor(await currentActor());
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

    const tenancy = await createTenancy(
      db,
      {
        unitId: body.unitId,
        tenantId: body.tenantId,
        start: body.start,
        end: (body.end as Month | null) ?? null,
        expectedRent: typeof body.expectedRent === "number" ? body.expectedRent : 0,
      },
      actor,
    );
    const named = (await listTenancies(db)).find((t) => t.id === tenancy.id);
    await record(
      db,
      actor,
      "tenancy.created",
      named ? `${named.unitLabel} — ${named.tenantName}` : `Tenancy #${tenancy.id}`,
      `From ${monthLabel(body.start.year, body.start.month)} at ${tenancy.expectedRent}`,
    );
    /* The raw row, not the enriched shape GET returns — named differently so a
     * caller cannot reach for fields this response never carried. */
    return Response.json({ created: { id: tenancy.id, unitId: tenancy.unitId, tenantId: tenancy.tenantId } }, { status: 201 });
  } catch (error) {
    return toResponse(error);
  }
}
