import { loadEnvConfig } from "@next/env";
import { assertTestBucket, assertTestDatabase } from "./guards";

/*
 * Next's own loader, per its guide for test setups: it walks the same
 * precedence chain the dev and build commands use and expands variables.
 * `process.loadEnvFile` reads one file and does neither, so a value defined
 * only in `.env` would be missing here while working everywhere else.
 *
 * Vitest already sets NODE_ENV to "test", which is what selects `.env.test`.
 */
loadEnvConfig(process.cwd(), /* dev */ true, { info: () => {}, error: console.error });

/*
 * Fail fast when the environment names a real database or bucket. Absent values
 * are left alone so pure-logic tests run before any infrastructure exists; the
 * tests that need them assert their presence themselves.
 */
if (process.env.DATABASE_URL) assertTestDatabase(process.env.DATABASE_URL);
if (process.env.R2_BUCKET) assertTestBucket(process.env.R2_BUCKET);
