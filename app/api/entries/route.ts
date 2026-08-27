import { requireEditorForYear } from "@/data/guard";
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
    requireEditorForYear(await currentActor(), body.year);

    const patch = { amount: body.amount, status: body.status };
    const entry =
      body.kind === "rent"
        ? await setRentAmount(db, body.targetId, body.year, body.month, patch)
        : await setBillAmount(db, body.targetId, body.year, body.month, patch);

    return Response.json({ entry });
  } catch (error) {
    return toResponse(error);
  }
}
