import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/*
 * `server-only` exists to make a bundler fail when a server module is pulled
 * into a client bundle. Tests import those modules deliberately, so it is
 * stubbed here rather than the modules being weakened to accommodate testing.
 */
const serverOnlyStub = fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url));

/**
 * Two projects, because the suite proves two different things. Pure
 * calculation and the server layer need no DOM; the screens cannot be asserted
 * without one. Splitting them keeps the fast tests fast.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true, alias: { "server-only": serverOnlyStub } },
  test: {
    projects: [
      {
        resolve: { tsconfigPaths: true, alias: { "server-only": serverOnlyStub } },
        test: {
          name: "server",
          environment: "node",
          /*
           * These files share one Postgres database and truncate it between
           * tests, so running them concurrently makes each one delete the
           * other's rows. Serial here costs a second; parallel makes failures
           * lie about which change broke what.
           */
          fileParallelism: false,
          include: [
            "lib/**/*.test.ts",
            "data/**/*.test.ts",
            "db/**/*.test.ts",
            "test/**/*.test.ts",
          ],
          setupFiles: ["./test/setup.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: { tsconfigPaths: true },
        test: {
          name: "screens",
          environment: "jsdom",
          include: ["components/**/*.test.tsx", "app/**/*.test.tsx"],
          setupFiles: ["./test/setup.ts"],
        },
      },
    ],
  },
});
