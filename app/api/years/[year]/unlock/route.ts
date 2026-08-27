import { requireEditor } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { relockYear, unlockYear } from "@/data/year";
import { db } from "@/db/client";

export async function POST(_request: Request, context: { params: Promise<{ year: string }> }) {
  try {
    const actor = requireEditor(await currentActor());
    const year = Number((await context.params).year);
    if (!Number.isInteger(year)) return Response.json({ error: "That is not a year." }, { status: 400 });

    await unlockYear(db, actor, year);
    return Response.json({ ok: true, unlockedYear: year });
  } catch (error) {
    return toResponse(error);
  }
}

export async function DELETE() {
  try {
    const actor = requireEditor(await currentActor());
    await relockYear(db, actor);
    return Response.json({ ok: true, unlockedYear: null });
  } catch (error) {
    return toResponse(error);
  }
}
