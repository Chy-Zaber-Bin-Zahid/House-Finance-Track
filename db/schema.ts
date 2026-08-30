import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/**
 * A tenancy is valid over a span of time, so the database stores a range and
 * refuses overlaps itself. Bounds are always half-open `[)`: the first day of
 * the start month, up to the first day of the month after the end month. An
 * open-ended tenancy stores an unbounded upper bound. Every requirement speaks
 * in months; the extra resolution of a date exists only to let Postgres do the
 * overlap check.
 */
export const daterange = customType<{ data: string; driverData: string }>({
  dataType: () => "daterange",
});

export const accountStatus = pgEnum("account_status", ["awaiting", "approved", "rejected"]);
export const accountRole = pgEnum("account_role", ["owner", "super_admin", "viewer"]);
export const entryStatus = pgEnum("entry_status", ["paid", "upcoming"]);
export const documentKind = pgEnum("document_kind", ["photo", "document"]);

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  /** Awaiting accounts cannot sign in; rejected ones never can. */
  status: accountStatus("status").notNull().default("awaiting"),
  /** Meaningful once approved. The owner role is only ever set by the boot seed. */
  role: accountRole("role"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  /**
   * The SHA-256 of the token in the cookie, never the token itself. A leaked
   * database dump then yields nothing that can be replayed as a session.
   */
  id: text("id").primaryKey(),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  /**
   * The one past year this session may write to, if its holder unlocked one.
   * Living here rather than in process memory is what makes the unlock private
   * to this session and dead when the session ends.
   */
  unlockedYear: integer("unlocked_year"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  floor: text("floor").notNull().default("Not set"),
});

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  notes: text("notes").notNull().default(""),
});

export const tenancies = pgTable("tenancies", {
  id: serial("id").primaryKey(),
  unitId: integer("unit_id")
    .notNull()
    .references(() => units.id, { onDelete: "restrict" }),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "restrict" }),
  period: daterange("period").notNull(),
  /** What this tenancy charges each month; drives the placeholder on the month screen. */
  expectedRent: integer("expected_rent").notNull().default(0),
});

/**
 * Metadata for a file whose bytes live in object storage. Deleting a tenant
 * takes their files with them: unlike money, a document is not history the
 * sheet depends on.
 */
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  kind: documentKind("kind").notNull().default("document"),
  /** Where the bytes are in the bucket. Never handed to a browser. */
  objectKey: text("object_key").notNull().unique(),
  name: text("name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentRelations = relations(documents, ({ one }) => ({
  tenant: one(tenants, { fields: [documents.tenantId], references: [tenants.id] }),
}));

export const billTypes = pgTable("bill_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  /** Retiring flips this off; reactivating flips it back on. */
  active: boolean("active").notNull().default(true),
});

/**
 * What was done, by whom, and when.
 *
 * Written alongside the change rather than derived from it: the sheet records
 * what a figure *is*, and no amount of reading it back says who moved it or
 * what it was before. Only the owner reads this.
 *
 * The actor's email is copied in rather than joined. An account can be removed,
 * and a log that forgets who did something the moment their account goes is not
 * a log — so `account_id` is the live link and `actor_email` is the record.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id").references(() => accounts.id, { onDelete: "set null" }),
    actorEmail: text("actor_email").notNull(),
    /** A stable dotted key, e.g. `tenancy.rent_changed`. Read by code. */
    action: text("action").notNull(),
    /** What it happened to, in the words the screen uses, e.g. `F1(B) — Anwar Hossain`. */
    subject: text("subject").notNull(),
    /** The change itself, already phrased for a reader. */
    detail: text("detail").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_events_recent").on(t.createdAt.desc())],
);

export const rentEntries = pgTable(
  "rent_entries",
  {
    id: serial("id").primaryKey(),
    tenancyId: integer("tenancy_id")
      .notNull()
      .references(() => tenancies.id, { onDelete: "restrict" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    amount: integer("amount").notNull().default(0),
    status: entryStatus("status").notNull().default("upcoming"),
  },
  (t) => [
    unique("rent_entries_tenancy_month").on(t.tenancyId, t.year, t.month),
    check("rent_entries_month_range", sql`${t.month} between 1 and 12`),
    check("rent_entries_amount_non_negative", sql`${t.amount} >= 0`),
  ],
);

export const billEntries = pgTable(
  "bill_entries",
  {
    id: serial("id").primaryKey(),
    billTypeId: integer("bill_type_id")
      .notNull()
      .references(() => billTypes.id, { onDelete: "restrict" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    amount: integer("amount").notNull().default(0),
    status: entryStatus("status").notNull().default("upcoming"),
  },
  (t) => [
    unique("bill_entries_type_month").on(t.billTypeId, t.year, t.month),
    check("bill_entries_month_range", sql`${t.month} between 1 and 12`),
    check("bill_entries_amount_non_negative", sql`${t.amount} >= 0`),
  ],
);

export const unitRelations = relations(units, ({ many }) => ({
  tenancies: many(tenancies),
}));

export const tenantRelations = relations(tenants, ({ many }) => ({
  tenancies: many(tenancies),
}));

export const tenancyRelations = relations(tenancies, ({ one, many }) => ({
  unit: one(units, { fields: [tenancies.unitId], references: [units.id] }),
  tenant: one(tenants, { fields: [tenancies.tenantId], references: [tenants.id] }),
  rent: many(rentEntries),
}));

export const rentEntryRelations = relations(rentEntries, ({ one }) => ({
  tenancy: one(tenancies, { fields: [rentEntries.tenancyId], references: [tenancies.id] }),
}));

export const billTypeRelations = relations(billTypes, ({ many }) => ({
  entries: many(billEntries),
}));

export const billEntryRelations = relations(billEntries, ({ one }) => ({
  billType: one(billTypes, { fields: [billEntries.billTypeId], references: [billTypes.id] }),
}));

export const accountRelations = relations(accounts, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
  account: one(accounts, { fields: [sessions.accountId], references: [accounts.id] }),
}));
