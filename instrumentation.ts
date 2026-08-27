/**
 * Runs once per server instance and must finish before requests are served,
 * which makes it the right place to guarantee an owner exists.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { db } = await import("@/db/client");
  const { seedOwner } = await import("@/data/owner");

  const outcome = await seedOwner(db);
  if (outcome === "created") console.log("Created the owner account from the environment.");
}
