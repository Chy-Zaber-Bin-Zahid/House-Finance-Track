import { requireApproved } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";

/** Who the browser is talking as, so screens can hide what this account cannot use. */
export async function GET() {
  try {
    const actor = requireApproved(await currentActor());
    return Response.json({
      actor: {
        email: actor.email,
        role: actor.role,
        unlockedYear: actor.unlockedYear,
      },
    });
  } catch (error) {
    return toResponse(error);
  }
}
