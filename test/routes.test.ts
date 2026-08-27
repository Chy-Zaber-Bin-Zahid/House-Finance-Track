import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `cookies()` is request-scoped and throws outside a request, so it is replaced
 * with a jar the harness controls. Everything else — the guards, the data
 * layer, the database — is real.
 */
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));

import { jar, jsonRequest, params, signedInAs, signedOut } from "./route-harness";
import { testDb, acquireSuiteLock, releaseSuiteLock, truncateAll } from "./db";

const { db, close } = testDb();

beforeAll(async () => {
  await acquireSuiteLock(db);
});

beforeEach(async () => {
  await truncateAll(db);
  signedOut();
});

afterAll(async () => {
  await releaseSuiteLock(db);
  await close();
});

const YEAR = new Date().getFullYear();

describe("a signed-out caller reaches nothing", () => {
  it("is refused on a read", async () => {
    const { GET } = await import("@/app/api/units/route");
    expect((await GET()).status).toBe(401);
  });

  it("is refused on a write", async () => {
    const { POST } = await import("@/app/api/units/route");
    const response = await POST(jsonRequest("http://t/api/units", "POST", { label: "X", floor: "y" }));
    expect(response.status).toBe(401);
  });
});

describe("a viewer reads and cannot write", () => {
  it("reads the unit list", async () => {
    await signedInAs("viewer");
    const { GET } = await import("@/app/api/units/route");
    expect((await GET()).status).toBe(200);
  });

  it("is refused creating a unit, at the server", async () => {
    await signedInAs("viewer");
    const { POST } = await import("@/app/api/units/route");
    const response = await POST(
      jsonRequest("http://t/api/units", "POST", { label: "F2", floor: "back" }),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).reason).toBe("read-only");
  });

  it("is refused recording money", async () => {
    await signedInAs("viewer");
    const { POST } = await import("@/app/api/entries/route");
    const response = await POST(
      jsonRequest("http://t/api/entries", "POST", {
        kind: "bill",
        targetId: 1,
        year: YEAR,
        month: 1,
        amount: 500,
      }),
    );
    expect(response.status).toBe(403);
  });

  it("is refused approving an account", async () => {
    await signedInAs("viewer");
    const { PATCH } = await import("@/app/api/accounts/[id]/route");
    const response = await PATCH(
      jsonRequest("http://t/api/accounts/1", "PATCH", { action: "approve", role: "viewer" }),
      params({ id: "1" }),
    );
    expect(response.status).toBe(403);
  });
});

describe("account administration is the owner's alone", () => {
  it("refuses a super-admin the approvals list", async () => {
    await signedInAs("super_admin");
    const { GET } = await import("@/app/api/accounts/route");
    const response = await GET();
    expect(response.status).toBe(403);
    expect((await response.json()).reason).toBe("owner-only");
  });

  it("allows the owner", async () => {
    await signedInAs("owner");
    const { GET } = await import("@/app/api/accounts/route");
    expect((await GET()).status).toBe(200);
  });
});

describe("the entries endpoint checks who before it checks what", () => {
  it("refuses a signed-out caller sending a malformed body, rather than validating it", async () => {
    const { POST } = await import("@/app/api/entries/route");
    const response = await POST(jsonRequest("http://t/api/entries", "POST", { nonsense: true }));
    expect(response.status).toBe(401);
  });

  it("rejects a malformed body from someone who may write", async () => {
    await signedInAs("super_admin");
    const { POST } = await import("@/app/api/entries/route");
    const response = await POST(jsonRequest("http://t/api/entries", "POST", { kind: "wrong" }));
    expect(response.status).toBe(400);
  });

  it("refuses a negative amount", async () => {
    await signedInAs("super_admin");
    const { POST } = await import("@/app/api/entries/route");
    const response = await POST(
      jsonRequest("http://t/api/entries", "POST", {
        kind: "bill",
        targetId: 1,
        year: YEAR,
        month: 1,
        amount: -5,
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("the year lock reaches the routes, not just the guard", () => {
  it("refuses a past-year write with no unlock", async () => {
    await signedInAs("super_admin");
    const { POST } = await import("@/app/api/entries/route");
    const response = await POST(
      jsonRequest("http://t/api/entries", "POST", {
        kind: "bill",
        targetId: 1,
        year: YEAR - 1,
        month: 1,
        amount: 100,
      }),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).reason).toBe("year-locked");
  });

  it("refuses opening a tenancy in a locked year through the route", async () => {
    await signedInAs("super_admin");
    const units = await import("@/app/api/units/route");
    const tenants = await import("@/app/api/tenants/route");
    const unit = (await (
      await units.POST(jsonRequest("http://t/api/units", "POST", { label: "F1", floor: "b" }))
    ).json()) as { unit: { id: number } };
    const tenant = (await (
      await tenants.POST(jsonRequest("http://t/api/tenants", "POST", { name: "Anwar" }))
    ).json()) as { tenant: { id: number } };

    const { POST } = await import("@/app/api/tenancies/route");
    const response = await POST(
      jsonRequest("http://t/api/tenancies", "POST", {
        unitId: unit.unit.id,
        tenantId: tenant.tenant.id,
        start: { year: YEAR - 1, month: 1 },
        end: null,
        expectedRent: 6000,
      }),
    );
    expect(response.status).toBe(409);
  });

  it("allows it once that session holds the unlock", async () => {
    await signedInAs("super_admin", { unlockedYear: YEAR - 1 });
    const units = await import("@/app/api/units/route");
    const tenants = await import("@/app/api/tenants/route");
    const unit = (await (
      await units.POST(jsonRequest("http://t/api/units", "POST", { label: "F1", floor: "b" }))
    ).json()) as { unit: { id: number } };
    const tenant = (await (
      await tenants.POST(jsonRequest("http://t/api/tenants", "POST", { name: "Anwar" }))
    ).json()) as { tenant: { id: number } };

    const { POST } = await import("@/app/api/tenancies/route");
    const response = await POST(
      jsonRequest("http://t/api/tenancies", "POST", {
        unitId: unit.unit.id,
        tenantId: tenant.tenant.id,
        start: { year: YEAR - 1, month: 1 },
        end: null,
        expectedRent: 6000,
      }),
    );
    expect(response.status).toBe(201);
  });
});

describe("refusals map to the status a client can branch on", () => {
  it("returns 400 for a tenancy that ends before it starts", async () => {
    await signedInAs("super_admin");
    const units = await import("@/app/api/units/route");
    const tenants = await import("@/app/api/tenants/route");
    const unit = (await (
      await units.POST(jsonRequest("http://t/api/units", "POST", { label: "F1", floor: "b" }))
    ).json()) as { unit: { id: number } };
    const tenant = (await (
      await tenants.POST(jsonRequest("http://t/api/tenants", "POST", { name: "Anwar" }))
    ).json()) as { tenant: { id: number } };

    const { POST } = await import("@/app/api/tenancies/route");
    const response = await POST(
      jsonRequest("http://t/api/tenancies", "POST", {
        unitId: unit.unit.id,
        tenantId: tenant.tenant.id,
        start: { year: YEAR, month: 6 },
        end: { year: YEAR, month: 1 },
        expectedRent: 6000,
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 404 for a record that does not exist", async () => {
    await signedInAs("super_admin");
    const { PATCH } = await import("@/app/api/units/[id]/route");
    const response = await PATCH(
      jsonRequest("http://t/api/units/9999", "PATCH", { label: "X" }),
      params({ id: "9999" }),
    );
    expect(response.status).toBe(404);
  });
});
