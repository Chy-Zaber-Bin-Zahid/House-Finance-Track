import { requireEditor } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { monthLabel, record } from "@/data/audit";
import {
  changeRentFrom,
  deleteTenancy,
  endTenancy,
  listTenancies,
  setExpectedRent,
} from "@/data/property";
import { db } from "@/db/client";

type Month = { year?: number; month?: number };

type Body = {
  end?: Month;
  /** A figure that was wrong from the start, corrected across the whole tenancy. */
  expectedRent?: number;
  /** A figure that genuinely changed, from a month on. Splits the tenancy. */
  changeRent?: { from?: Month; expectedRent?: number };
};

function isMonth(value: Month | undefined): value is { year: number; month: number } {
  return (
    typeof value?.year === "number" &&
    typeof value.month === "number" &&
    value.month >= 1 &&
    value.month <= 12
  );
}

function isAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = requireEditor(await currentActor());
    const id = Number((await context.params).id);
    const body = (await request.json()) as Body;

    /* The rent changed from a month on: the tenancy splits in two. */
    if (body.changeRent !== undefined) {
      if (!isMonth(body.changeRent.from)) {
        return Response.json({ error: "A month to change from is required." }, { status: 400 });
      }
      if (!isAmount(body.changeRent.expectedRent)) {
        return Response.json({ error: "A rent cannot be negative." }, { status: 400 });
      }
      const before = (await listTenancies(db)).find((t) => t.id === id);
      const result = await changeRentFrom(
        db,
        id,
        body.changeRent.from,
        body.changeRent.expectedRent,
        actor,
      );
      await record(
        db,
        actor,
        "tenancy.rent_changed",
        before ? `${before.unitLabel} — ${before.tenantName}` : `Tenancy #${id}`,
        `${before?.expectedRent ?? "?"} → ${body.changeRent.expectedRent} from ` +
          monthLabel(body.changeRent.from.year, body.changeRent.from.month),
      );
      return Response.json({ rent: { tenancyId: result.tenancy.id, split: result.split } });
    }

    /* The figure was simply wrong. Same months, new number. */
    if (body.expectedRent !== undefined) {
      if (!isAmount(body.expectedRent)) {
        return Response.json({ error: "A rent cannot be negative." }, { status: 400 });
      }
      const before = (await listTenancies(db)).find((t) => t.id === id);
      const row = await setExpectedRent(db, id, body.expectedRent);
      await record(
        db,
        actor,
        "tenancy.rent_changed",
        before ? `${before.unitLabel} — ${before.tenantName}` : `Tenancy #${id}`,
        `Corrected ${before?.expectedRent ?? "?"} → ${body.expectedRent} across every month`,
      );
      return Response.json({ rent: { tenancyId: row.id, split: false } });
    }

    if (!isMonth(body.end)) {
      return Response.json({ error: "An end month is required." }, { status: 400 });
    }
    const before = (await listTenancies(db)).find((t) => t.id === id);
    const ended = await endTenancy(db, id, { year: body.end.year, month: body.end.month }, actor);
    await record(
      db,
      actor,
      "tenancy.ended",
      before ? `${before.unitLabel} — ${before.tenantName}` : `Tenancy #${id}`,
      `Last month ${monthLabel(body.end.year, body.end.month)}`,
    );
    return Response.json({ ended: { id: ended.id } });
  } catch (error) {
    return toResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = requireEditor(await currentActor());
    const id = Number((await context.params).id);
    const before = (await listTenancies(db)).find((t) => t.id === id);
    await deleteTenancy(db, id, actor);
    await record(
      db,
      actor,
      "tenancy.removed",
      before ? `${before.unitLabel} — ${before.tenantName}` : `Tenancy #${id}`,
    );
    return Response.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
