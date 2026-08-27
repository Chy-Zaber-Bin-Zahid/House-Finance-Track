import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * A connection built from an explicit URL, for scripts and tests that run
 * outside the server. The application uses `db/client.ts` instead, which is
 * server-only and reads the ambient environment.
 */
export function connect(url: string, max = 1) {
  const client = postgres(url, { max });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}
