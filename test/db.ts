import { sql } from "drizzle-orm";
import { connect } from "@/db/connect";
import { assertTestDatabase } from "./guards";

/**
 * A connection to the test database, refused unless the URL names one. Every
 * test file starts from a known-empty state; the suite proves database-level
 * behaviour, so leftover rows from a prior file would make failures lie.
 */
export function testDb() {
  const url = process.env.DATABASE_URL;
  assertTestDatabase(url);
  return connect(url as string);
}

const TABLES = [
  "audit_events",
  "rent_entries",
  "bill_entries",
  "tenancies",
  "bill_types",
  "tenants",
  "units",
  "sessions",
  "accounts",
] as const;

/**
 * A lock the whole suite holds, so two runs against one database queue instead
 * of truncating each other's rows mid-test. `fileParallelism: false` only
 * orders files within a single run; nothing stopped a second `npm test`, or CI
 * alongside a developer, from producing failures that pointed at the wrong
 * change.
 */
const SUITE_LOCK = 8_027_2026;

export async function acquireSuiteLock(db: ReturnType<typeof testDb>["db"]): Promise<void> {
  await db.execute(sql.raw(`SELECT pg_advisory_lock(${SUITE_LOCK})`));
}

export async function releaseSuiteLock(db: ReturnType<typeof testDb>["db"]): Promise<void> {
  await db.execute(sql.raw(`SELECT pg_advisory_unlock(${SUITE_LOCK})`));
}

export async function truncateAll(db: ReturnType<typeof testDb>["db"]): Promise<void> {
  await db.execute(
    sql.raw(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`),
  );
}

/**
 * Drizzle wraps a driver error, so `Failed query: …` is all a plain assertion
 * sees. Unwrap to the Postgres error and return its constraint name, so a test
 * can assert that the *specific* guard fired rather than that something failed.
 */
export async function expectRejection(
  promise: Promise<unknown>,
): Promise<{ constraint: string | undefined; message: string }> {
  try {
    await promise;
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause ?? error;
    const pg = cause as { constraint_name?: string; message?: string };
    return { constraint: pg.constraint_name, message: pg.message ?? String(error) };
  }
  throw new Error("Expected the database to reject this, but it succeeded.");
}
