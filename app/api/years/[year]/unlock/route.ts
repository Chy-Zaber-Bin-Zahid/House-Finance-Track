import { record } from "@/data/audit";
import { requireEditor } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { relockYear, unlockYear } from "@/data/year";
import { db } from "@/db/client";

export async function POST(_request: Request, context: { params: Promise<{ year: string }> }) {
  try {
    const actor = requireEditor(await currentActor());
    const year = Number((await context.params).year);
    if (!Number.isInteger(year)) return Response.json({ error: "That is not a year." }, { status: 400 });

    const { replaced } = await unlockYear(db, actor, year);
    await record(db, actor, "year.unlocked", String(year), replaced ? `Relocked ${replaced}` : "");
    return Response.json({ ok: true, unlockedYear: year, relocked: replaced });
  } catch (error) {
    return toResponse(error);
  }
}

export async function DELETE() {
  try {
    const actor = requireEditor(await currentActor());
    const wasUnlocked = actor.unlockedYear;
    await relockYear(db, actor);
    await record(db, actor, "year.relocked", wasUnlocked ? String(wasUnlocked) : "None");
    return Response.json({ ok: true, unlockedYear: null });
  } catch (error) {
    return toResponse(error);
  }
}
