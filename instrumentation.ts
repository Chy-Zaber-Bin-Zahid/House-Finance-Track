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

  /* Sessions that expired while the server was down have no reason to persist. */
  const { purgeExpiredSessions } = await import("@/data/session");
  await purgeExpiredSessions(db);

  /*
   * Say so rather than let it be discovered. Without a declared proxy depth the
   * app cannot tell one caller from another, so the per-caller limits on
   * sign-in and registration do not run and the only bound left is per email.
   * That is fine on a home network and not fine facing the internet.
   */
  if (process.env.NODE_ENV === "production" && !Number(process.env.TRUSTED_PROXY_HOPS ?? "0")) {
    console.warn(
      "TRUSTED_PROXY_HOPS is not set, so callers cannot be told apart and per-address rate " +
        "limiting is off. Set it to the number of proxies in front of this app, and rate limit " +
        "at the edge as well.",
    );
  }
}
