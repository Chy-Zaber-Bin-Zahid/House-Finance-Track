import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { sessions } from "@/db/schema";
import { AccessDenied } from "./errors";
import { currentYear } from "./guard";
import type { Actor } from "./session";

/**
 * Unlocking a past year for the session that asked.
 *
 * The unlock lives on the session row, which is what makes it invisible to
 * everyone else and dead when the session ends. A second super-admin looking at
 * the same year still sees it read-only and must unlock it themselves.
 */
export async function unlockYear(
  db: Database,
  actor: Actor,
  year: number,
  now: Date = new Date(),
): Promise<void> {
  const current = currentYear(now);

  if (year === current) {
    throw new AccessDenied("year-locked", "The current year is already open.");
  }
  /*
   * Only a past year can be unlocked, per the requirement. A consequence worth
   * knowing: next year cannot be written ahead of time.
   */
  if (year > current) {
    throw new AccessDenied("year-locked", "A year that has not started yet cannot be unlocked.");
  }

  await db.update(sessions).set({ unlockedYear: year }).where(eq(sessions.id, actor.sessionId));
}

export async function relockYear(db: Database, actor: Actor): Promise<void> {
  await db.update(sessions).set({ unlockedYear: null }).where(eq(sessions.id, actor.sessionId));
}

/** What the year screen needs to render its banner. */
export function yearState(actor: Actor, year: number, now: Date = new Date()) {
  const current = currentYear(now);
  const editable =
    year === current ||
    (actor.unlockedYear === year && (actor.role === "owner" || actor.role === "super_admin"));
  return {
    year,
    isCurrent: year === current,
    editable,
    canUnlock:
      year < current && (actor.role === "owner" || actor.role === "super_admin") && !editable,
  };
}
