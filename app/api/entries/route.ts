import { describeEntry, monthLabel, record } from "@/data/audit";
import { requireEditor, requireEditorForYear } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { setBillAmount, setRentAmount, type EntryStatus } from "@/data/ledger";
import { db } from "@/db/client";

type Body = {
  kind?: "rent" | "bill";
  /** The tenancy for rent, the bill type for a bill. */
  targetId?: number;
  year?: number;
  month?: number;
  amount?: number;
  status?: EntryStatus;
};

export async function POST(request: Request) {
  try {
    /* Turn away a caller who was never going to be allowed to write, before
     * doing any work on their input - the shape every sibling handler uses. */
    requireEditor(await currentActor());

    const body = (await request.json()) as Body;

    if (
      (body.kind !== "rent" && body.kind !== "bill") ||
      typeof body.targetId !== "number" ||
      typeof body.year !== "number" ||
      typeof body.month !== "number" ||
      body.month < 1 ||
      body.month > 12
    ) {
      return Response.json({ error: "That is not a cell on the sheet." }, { status: 400 });
    }
    if (body.amount !== undefined && (typeof body.amount !== "number" || body.amount < 0)) {
      return Response.json({ error: "An amount cannot be negative." }, { status: 400 });
    }
    if (body.status !== undefined && body.status !== "paid" && body.status !== "upcoming") {
      return Response.json({ error: "Unknown status." }, { status: 400 });
    }

    /* Editing a year that is not the current one needs an unlock this session holds. */
    const actor = requireEditorForYear(await currentActor(), body.year);

    const patch = { amount: body.amount, status: body.status };
    const entry =
      body.kind === "rent"
        ? await setRentAmount(db, body.targetId, body.year, body.month, patch)
        : await setBillAmount(db, body.targetId, body.year, body.month, patch);

    const target = await describeEntry(db, body.kind, body.targetId);
    await record(
      db,
      actor,
      body.kind === "rent" ? "entry.rent_set" : "entry.bill_set",
      `${target} · ${monthLabel(body.year, body.month)}`,
      [
        body.amount === undefined ? null : `Set to ${body.amount}`,
        body.status === undefined ? null : `Marked ${body.status}`,
      ]
        .filter(Boolean)
        .join(", "),
    );

    return Response.json({ entry });
  } catch (error) {
    return toResponse(error);
  }
}
