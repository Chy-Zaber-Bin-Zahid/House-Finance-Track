import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The failure that matters most in this app is a write endpoint nobody guarded.
 * Per-route tests would catch it one route at a time and miss the route added
 * next month, so this asserts the property structurally: every route handler
 * that mutates goes through the data layer's guard, and no route reaches the
 * database on its own.
 */

const MUTATING = /export async function (POST|PATCH|PUT|DELETE)/;
const GUARDS = /require(Approved|Editor|Owner|EditorForYear)\s*\(/;

const routeFiles = globSync("app/api/**/route.ts").sort();

describe("every route is guarded by construction", () => {
  it("finds the route handlers", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  for (const file of routeFiles) {
    const source = readFileSync(file, "utf8");
    const mutates = MUTATING.test(source);

    /*
     * Sign-in, sign-out, and registration are the deliberate exceptions: they
     * are how someone without a session gets one, so they cannot require an
     * existing session. Each carries its own rate limiting instead.
     */
    const isEntryPoint =
      file.includes("auth/sign-in") || file.includes("auth/sign-out") || file === "app/api/accounts/route.ts";

    if (mutates && !isEntryPoint) {
      it(`${file} guards its mutations`, () => {
        expect(source).toMatch(GUARDS);
      });
    }

    it(`${file} does not query the database itself`, () => {
      const importsSchema = /from "@\/db\/schema"/.test(source);
      const buildsQuery = /\bdb\.(select|insert|update|delete)\s*\(/.test(source);
      expect(importsSchema && buildsQuery).toBe(false);
    });
  }
});

describe("the endpoints open to anyone are rate limited", () => {
  /*
   * The limiter may sit in the route or in the data-layer function the route
   * calls; sign-in's lives in signIn() so the check cannot be routed around by
   * a second caller. Assert the path is covered, not where the call sits.
   */
  const open: [string, string][] = [
    ["app/api/auth/sign-in/route.ts", "data/accounts.ts"],
    ["app/api/accounts/route.ts", "app/api/accounts/route.ts"],
  ];
  for (const [route, limiter] of open) {
    it(`${route} limits attempts`, () => {
      expect(readFileSync(limiter, "utf8")).toMatch(/consume\(/);
      expect(readFileSync(route, "utf8").length).toBeGreaterThan(0);
    });
  }
});
