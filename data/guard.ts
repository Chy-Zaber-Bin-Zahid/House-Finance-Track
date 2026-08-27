import { AccessDenied } from "./errors";
import type { Actor } from "./session";

/**
 * The single place that decides who may do what.
 *
 * Every mutation goes through one of these rather than checking inline,
 * because the failure that matters most here is a check someone forgot to
 * write. A control hidden in the interface is a convenience; this is the
 * boundary.
 */

/** Signed in and let in. */
export function requireApproved(actor: Actor | null): Actor {
  if (!actor) throw new AccessDenied("signed-out", "Sign in to continue.");
  if (actor.status === "awaiting") {
    throw new AccessDenied("awaiting-approval", "This account is waiting to be approved.");
  }
  if (actor.status === "rejected") {
    throw new AccessDenied("rejected", "This account was not approved.");
  }
  return actor;
}

/** Allowed to change data. The owner holds every super-admin permission. */
export function requireEditor(actor: Actor | null): Actor {
  const approved = requireApproved(actor);
  if (approved.role !== "owner" && approved.role !== "super_admin") {
    throw new AccessDenied("read-only", "This account can view the sheet but not change it.");
  }
  return approved;
}

/** Account administration is the owner's alone. */
export function requireOwner(actor: Actor | null): Actor {
  const approved = requireApproved(actor);
  if (approved.role !== "owner") {
    throw new AccessDenied("owner-only", "Only the owner can do that.");
  }
  return approved;
}

/** The year the server considers current, decided at request time. */
export function currentYear(now: Date = new Date()): number {
  return now.getFullYear();
}

/**
 * Writing to a year that is not the current one needs an unlock, and the
 * unlock belongs to the session that opened it — another super-admin looking
 * at the same year still sees it read-only.
 */
export function requireWritableYear(actor: Actor, year: number, now: Date = new Date()): void {
  if (year === currentYear(now)) return;
  if (actor.unlockedYear === year) return;
  throw new AccessDenied(
    "year-locked",
    `${year} is read-only. Unlock it first if you need to change it.`,
  );
}

/** An editor writing to a given year — the check most endpoints need. */
export function requireEditorForYear(actor: Actor | null, year: number, now: Date = new Date()): Actor {
  const editor = requireEditor(actor);
  requireWritableYear(editor, year, now);
  return editor;
}
