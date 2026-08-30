import { desc, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { accounts, auditEvents, billTypes, tenancies, tenants, units } from "@/db/schema";
import { MONTH_NAMES } from "@/lib/seed";
import { requireOwner } from "./guard";
import type { Actor } from "./session";

/**
 * The trail of what people did.
 *
 * Recorded next to the change, never derived from it: the sheet says what a
 * figure is now, and nothing in it says who moved it or what it was before.
 *
 * Reading is the owner's alone — it names every account and what they touched,
 * which is more than a super-admin needs to do their job.
 */

/** The actions worth a line. Kept as one list so the page can name them all. */
export const AUDIT_ACTIONS = {
  "account.approved": "Approved an account",
  "account.rejected": "Rejected an account",
  "account.role_changed": "Changed a role",
  "account.password_changed": "Changed their password",
  "year.unlocked": "Unlocked a year",
  "year.relocked": "Locked a year",
  "unit.created": "Added a unit",
  "unit.renamed": "Renamed a unit",
  "unit.removed": "Removed a unit",
  "tenant.created": "Added a tenant",
  "tenant.updated": "Edited a tenant",
  "tenant.removed": "Removed a tenant",
  "tenancy.created": "Let a unit",
  "tenancy.ended": "Ended a tenancy",
  "tenancy.removed": "Removed a tenancy",
  "tenancy.rent_changed": "Changed the rent",
  "billType.created": "Added a bill",
  "billType.renamed": "Renamed a bill",
  "billType.retired": "Retired a bill",
  "billType.restored": "Restored a bill",
  "billType.removed": "Removed a bill",
  "document.added": "Added a file",
  "document.removed": "Removed a file",
  "entry.rent_set": "Recorded rent",
  "entry.bill_set": "Recorded a bill",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

/**
 * Write one line of the trail.
 *
 * Never throws. A failure here must not roll back the change it describes —
 * losing a log line is bad, and losing the user's edit because the log line
 * failed is worse. The failure goes to the server log instead.
 */
export async function record(
  db: Database,
  actor: Actor,
  action: AuditAction,
  subject: string,
  detail = "",
): Promise<void> {
  try {
    await db.insert(auditEvents).values({
      accountId: actor.accountId,
      actorEmail: actor.email,
      action,
      subject: subject.slice(0, 200),
      detail: detail.slice(0, 500),
    });
  } catch (error) {
    console.error("Could not record an audit event", { action, subject, error });
  }
}

/** `Mar 2026`, the way every other screen writes a month. */
export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]?.slice(0, 3) ?? month} ${year}`;
}

/**
 * A money cell in the words the sheet uses, so a line reads "F1(B) rent · Mar
 * 2026" rather than a pair of row ids nobody can place.
 */
export async function describeEntry(
  db: Database,
  kind: "rent" | "bill",
  targetId: number,
): Promise<string> {
  if (kind === "bill") {
    const [type] = await db
      .select({ name: billTypes.name })
      .from(billTypes)
      .where(eq(billTypes.id, targetId))
      .limit(1);
    return type?.name ?? `Bill #${targetId}`;
  }

  const [row] = await db
    .select({ unit: units.label, tenant: tenants.name })
    .from(tenancies)
    .innerJoin(units, eq(units.id, tenancies.unitId))
    .innerJoin(tenants, eq(tenants.id, tenancies.tenantId))
    .where(eq(tenancies.id, targetId))
    .limit(1);
  return row ? `${row.unit} rent — ${row.tenant}` : `Tenancy #${targetId}`;
}

/** A tenant's name, for saying whose file was added or removed. */
export async function tenantName(db: Database, id: number): Promise<string> {
  const [row] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, id)).limit(1);
  return row?.name ?? `Tenant #${id}`;
}

/** The email on an account, for naming who a change was made *to*. */
export async function accountEmail(db: Database, id: number): Promise<string> {
  const [row] = await db
    .select({ email: accounts.email })
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  return row?.email ?? `Account #${id}`;
}

export type AuditPage = {
  events: {
    id: number;
    actorEmail: string;
    stillAnAccount: boolean;
    action: string;
    label: string;
    subject: string;
    detail: string;
    createdAt: string;
  }[];
  /** One more page exists beyond this one. */
  more: boolean;
  actors: string[];
};

const PAGE_SIZE = 60;

export async function readAuditLog(
  db: Database,
  actor: Actor | null,
  options: { before?: number; actorEmail?: string } = {},
): Promise<AuditPage> {
  requireOwner(actor);

  const filters = [];
  if (options.before !== undefined) filters.push(sql`${auditEvents.id} < ${options.before}`);
  if (options.actorEmail) filters.push(sql`${auditEvents.actorEmail} = ${options.actorEmail}`);

  const rows = await db
    .select()
    .from(auditEvents)
    .where(filters.length ? sql.join(filters, sql` and `) : undefined)
    .orderBy(desc(auditEvents.id))
    /* One extra, to learn whether a next page exists without counting the table. */
    .limit(PAGE_SIZE + 1);

  const page = rows.slice(0, PAGE_SIZE);

  /* Which of the recorded emails still have an account, so the page can mark
   * the ones that do not rather than implying they were never real. */
  const live = new Set((await db.select({ email: accounts.email }).from(accounts)).map((a) => a.email));

  const everyActor = await db
    .selectDistinct({ email: auditEvents.actorEmail })
    .from(auditEvents)
    .orderBy(auditEvents.actorEmail);

  return {
    events: page.map((row) => ({
      id: row.id,
      actorEmail: row.actorEmail,
      stillAnAccount: live.has(row.actorEmail),
      action: row.action,
      label: AUDIT_ACTIONS[row.action as AuditAction] ?? row.action,
      subject: row.subject,
      detail: row.detail,
      createdAt: row.createdAt.toISOString(),
    })),
    more: rows.length > PAGE_SIZE,
    actors: everyActor.map((a) => a.email),
  };
}
