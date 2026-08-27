import { defineConfig } from "drizzle-kit";

/*
 * Use `db:generate` + `db:migrate`, never `drizzle-kit push`.
 *
 * The tenancies table carries an EXCLUDE constraint and the btree_gist
 * extension, hand-written in migration 0000 because the schema DSL cannot
 * express them. `generate` diffs schema.ts against its snapshot and leaves both
 * alone; `push` introspects the live database, sees constraints it has no way
 * to represent, and will offer to drop them.
 */

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    /* No fallback: a migration pointed at a default nobody chose is worse than one that refuses to run. */
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
});
