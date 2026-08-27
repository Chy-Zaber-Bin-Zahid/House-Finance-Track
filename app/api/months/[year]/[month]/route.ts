import { requireApproved } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { billTypesForYear, monthTotals, tenanciesForMonth, yearSheet } from "@/data/ledger";
import { db } from "@/db/client";

export async function GET(
  _request: Request,
  context: { params: Promise<{ year: string; month: string }> },
) {
  try {
    requireApproved(await currentActor());
    const { year: rawYear, month: rawMonth } = await context.params;
    const year = Number(rawYear);
    const month = Number(rawMonth);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return Response.json({ error: "That is not a month." }, { status: 400 });
    }

    const [types, running, totals, sheet] = await Promise.all([
      billTypesForYear(db, year),
      tenanciesForMonth(db, year, month),
      monthTotals(db, year, month),
      yearSheet(db, year),
    ]);

    const cells = sheet.months[month - 1];
    return Response.json({ year, month, billTypes: types, tenancies: running, totals, cells });
  } catch (error) {
    return toResponse(error);
  }
}
