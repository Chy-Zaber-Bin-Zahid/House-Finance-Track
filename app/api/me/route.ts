import { requireApproved } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { yearState } from "@/data/year";

/** Who the browser is talking as, so screens can hide what this account cannot use. */
export async function GET(request: Request) {
  try {
    const actor = requireApproved(await currentActor());

    /*
     * The server decides whether a year is editable, using its own clock. Both
     * screens used to re-derive this from the browser's, which disagrees across
     * a timezone or a skewed device exactly when it matters — on 31 December.
     */
    const asked = Number(new URL(request.url).searchParams.get("year"));
    const year = Number.isInteger(asked) ? asked : new Date().getFullYear();

    return Response.json({
      actor: {
        email: actor.email,
        role: actor.role,
        unlockedYear: actor.unlockedYear,
      },
      year: yearState(actor, year),
    });
  } catch (error) {
    return toResponse(error);
  }
}
