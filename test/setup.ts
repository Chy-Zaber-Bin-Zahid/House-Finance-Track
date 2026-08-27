import { existsSync } from "node:fs";
import { assertTestBucket, assertTestDatabase } from "./guards";

if (existsSync(".env.test")) {
  process.loadEnvFile(".env.test");
}

/*
 * Fail fast when the environment names a real database or bucket. Absent values
 * are left alone so pure-logic tests run before any infrastructure exists; the
 * tests that need them assert their presence themselves.
 */
if (process.env.DATABASE_URL) assertTestDatabase(process.env.DATABASE_URL);
if (process.env.R2_BUCKET) assertTestBucket(process.env.R2_BUCKET);
