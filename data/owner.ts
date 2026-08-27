import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { accounts } from "@/db/schema";
import { hashPassword } from "./passwords";

/**
 * Creates the one account nobody can register as.
 *
 * Runs on boot, before the server accepts requests, so no request can arrive
 * before an owner exists. Registration never produces the owner role; this is
 * the only path to it.
 */
export async function seedOwner(
  db: Database,
  env: { email?: string; password?: string; reseed?: string } = {},
): Promise<"created" | "kept" | "reseeded"> {
  const email = (env.email ?? process.env.OWNER_EMAIL)?.trim().toLowerCase();
  const password = env.password ?? process.env.OWNER_PASSWORD;
  const reseed = (env.reseed ?? process.env.OWNER_PASSWORD_RESEED) === "true";

  if (!email || !password) {
    throw new Error(
      "OWNER_EMAIL and OWNER_PASSWORD must both be set. Without them the app starts with no way in.",
    );
  }

  const [existing] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);

  if (!existing) {
    await db.insert(accounts).values({
      email,
      passwordHash: await hashPassword(password),
      status: "approved",
      role: "owner",
    });
    return "created";
  }

  /*
   * The owner can change this password in the app, so a later boot must not
   * quietly put the environment's value back. Without an escape hatch, though,
   * an owner who forgets the changed password kills the system: nobody else can
   * approve an account or change a role. This flag is that escape hatch, and it
   * is deliberately explicit.
   */
  if (reseed) {
    await db
      .update(accounts)
      .set({ passwordHash: await hashPassword(password), status: "approved", role: "owner" })
      .where(eq(accounts.id, existing.id));
    console.warn(
      `OWNER_PASSWORD_RESEED was set: the owner password for ${email} was overwritten from the environment.`,
    );
    return "reseeded";
  }

  return "kept";
}
