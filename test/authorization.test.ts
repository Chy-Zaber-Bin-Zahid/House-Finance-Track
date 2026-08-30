import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The failure that matters most in this app is a write endpoint nobody guarded.
 * Per-route tests would catch today's routes and miss the one added next month,
 * so this asserts the property structurally.
 *
 * It checks each handler separately rather than the file as a whole: a file-wide
 * match passes when a guarded GET sits beside an unguarded DELETE, which is
 * precisely the shape every multi-handler route file here has.
 */

const HANDLER = /export async function (GET|POST|PATCH|PUT|DELETE)\b/g;
/** Guards that authorise a write. `requireApproved` only proves the caller is signed in. */
const WRITE_GUARDS = /require(Editor|Owner|EditorForYear)\s*\(/;
const ANY_GUARD = /require(Approved|Editor|Owner|EditorForYear)\s*\(/;

/** Anything that reaches the database without going through data/. */
const DIRECT_DB =
  /\bdb\.(select|insert|update|delete|execute|transaction)\s*\(|\bdb\.query\.|from\s+"@\/db\/(client|schema)"/;

type Handler = { method: string; body: string };

function handlers(source: string): Handler[] {
  const marks = [...source.matchAll(HANDLER)];
  return marks.map((mark, i) => ({
    method: mark[1],
    body: source.slice(mark.index ?? 0, marks[i + 1]?.index ?? source.length),
  }));
}

const routeFiles = globSync("app/api/**/route.ts").sort();

/**
 * The three ways in without a session. Each is exempt per handler, not per file:
 * the accounts GET still has to prove it is owner-only.
 */
const OPEN: Record<string, string[]> = {
  "app/api/auth/sign-in/route.ts": ["POST"],
  "app/api/auth/sign-out/route.ts": ["POST"],
  "app/api/accounts/route.ts": ["POST"],
};

/**
 * Writes to your own account rather than to the ledger. A viewer must be able
 * to change their own password, so these need a session but not edit rights.
 * Each still has to act only on the caller's own account id.
 */
const SELF_SERVICE: Record<string, string[]> = {
  "app/api/account/password/route.ts": ["POST"],
};

describe("every mutating handler is guarded, one handler at a time", () => {
  it("finds the route handlers", () => {
    expect(routeFiles.length).toBeGreaterThan(10);
  });

  for (const file of routeFiles) {
    const source = readFileSync(file, "utf8");

    for (const { method, body } of handlers(source)) {
      const isOpen = OPEN[file]?.includes(method) ?? false;
      const mutates = method !== "GET";

      const isSelfService = SELF_SERVICE[file]?.includes(method) ?? false;

      if (mutates && !isOpen && !isSelfService) {
        it(`${file} ${method} authorises the write`, () => {
          expect(body).toMatch(WRITE_GUARDS);
        });
      }

      if (isSelfService) {
        it(`${file} ${method} requires a session and writes only to the caller`, () => {
          expect(body).toMatch(ANY_GUARD);
          expect(body).toMatch(/actor\.accountId/);
        });
      }

      if (!mutates && !isOpen) {
        it(`${file} ${method} requires a session`, () => {
          expect(body).toMatch(ANY_GUARD);
        });
      }
    }

    it(`${file} reaches the database only through data/`, () => {
      expect(DIRECT_DB.test(source.replace(/from "@\/db\/client";/g, ""))).toBe(false);
    });
  }
});

describe("the endpoints open to anyone are rate limited", () => {
  const open: [string, string][] = [
    ["app/api/auth/sign-in/route.ts", "data/accounts.ts"],
    ["app/api/accounts/route.ts", "app/api/accounts/route.ts"],
  ];
  for (const [route, limiter] of open) {
    it(`${route} limits attempts`, () => {
      /* Either entry point: `consumePerCaller` is `consume` keyed on the
       * caller, and skips itself where the caller cannot be identified. */
      expect(readFileSync(limiter, "utf8")).toMatch(/consume(PerCaller)?\(/);
    });
  }
});

describe("the check itself can fail", () => {
  it("rejects a handler that mutates without a write guard", () => {
    const bad = `
      export async function GET() { requireApproved(await currentActor()); }
      export async function DELETE() { await deleteThing(db, 1); }
    `;
    const found = handlers(bad);
    expect(found).toHaveLength(2);
    expect(found[1].method).toBe("DELETE");
    expect(WRITE_GUARDS.test(found[1].body)).toBe(false);
  });

  it("rejects a mutating handler guarded only by requireApproved", () => {
    const weak = `export async function PATCH() { requireApproved(await currentActor()); }`;
    expect(WRITE_GUARDS.test(handlers(weak)[0].body)).toBe(false);
  });

  it("catches a route querying the database by raw sql or the relational api", () => {
    expect(DIRECT_DB.test(`await db.execute(sql\`select 1\`)`)).toBe(true);
    expect(DIRECT_DB.test(`await db.query.units.findMany()`)).toBe(true);
  });
});
