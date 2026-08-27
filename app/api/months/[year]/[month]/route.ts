import { requireApproved } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { monthTotals, tenanciesForMonth, yearSheet } from "@/data/ledger";
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

    const [running, totals, sheet] = await Promise.all([
      tenanciesForMonth(db, year, month),
      monthTotals(db, year, month),
      yearSheet(db, year),
    ]);

    /* yearSheet already resolved the year's bill types; asking twice ran the
     * same two queries for the same answer. */
    const cells = sheet.months[month - 1];
    return Response.json({
      year,
      month,
      billTypes: sheet.billTypes,
      tenancies: running,
      totals,
      cells,
    });
  } catch (error) {
    return toResponse(error);
  }
}
