import { defineConfig } from "drizzle-kit";

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
