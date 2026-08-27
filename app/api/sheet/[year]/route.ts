import { requireApproved } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { currentYear } from "@/data/guard";
import { yearSheet, yearsWithData, yearTotals } from "@/data/ledger";
import { db } from "@/db/client";

export async function GET(_request: Request, context: { params: Promise<{ year: string }> }) {
  try {
    requireApproved(await currentActor());
    const year = Number((await context.params).year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return Response.json({ error: "That is not a year." }, { status: 400 });
    }

    const [sheet, totals, years] = await Promise.all([
      yearSheet(db, year),
      yearTotals(db, year),
      yearsWithData(db),
    ]);
    /* The server's year, so the picker does not offer one the browser invented. */
    return Response.json({ sheet, totals, years, currentYear: currentYear() });
  } catch (error) {
    return toResponse(error);
  }
}
