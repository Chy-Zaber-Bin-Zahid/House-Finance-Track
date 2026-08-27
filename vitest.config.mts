import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Two projects, because the suite proves two different things. Pure
 * calculation and the server layer need no DOM; the screens cannot be asserted
 * without one. Splitting them keeps the fast tests fast.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "server",
          environment: "node",
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
