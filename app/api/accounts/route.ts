import { register } from "@/data/accounts";
import { listAccounts } from "@/data/approvals";
import { requireOwner } from "@/data/guard";
import { addressOf, currentActor, toResponse } from "@/data/http";
import { WeakPassword } from "@/data/passwords";
import { consume, REGISTER_PER_ADDRESS } from "@/data/rate-limit";
import { db } from "@/db/client";

/** Open to anyone: this is how a family member asks for access. */
export async function POST(request: Request) {
  try {
    if (!consume(`register:${addressOf(request)}`, REGISTER_PER_ADDRESS)) {
      return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const body = (await request.json()) as { email?: unknown; password?: unknown };
    if (typeof body.email !== "string" || typeof body.password !== "string") {
      return Response.json({ error: "Email and password are required." }, { status: 400 });
    }

    await register(db, body.email, body.password);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof WeakPassword) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return toResponse(error);
  }
}

export async function GET() {
  try {
    requireOwner(await currentActor());
    return Response.json({ accounts: await listAccounts(db) });
  } catch (error) {
    return toResponse(error);
  }
}
