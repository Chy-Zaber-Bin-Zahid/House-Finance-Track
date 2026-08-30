import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { documents } from "@/db/schema";
import { testDb, acquireSuiteLock, releaseSuiteLock, truncateAll } from "@/test/db";
import type { Database } from "@/db/client";
import { NotFound, StillReferenced } from "./errors";
import {
  listDocuments,
  MAX_UPLOAD_BYTES,
  openDocument,
  photoFor,
  removeDocument,
  saveDocument,
  UploadTooLarge,
} from "./files";
import { createTenancy, createTenant, createUnit, deleteTenant } from "./property";
import { MemoryStore, useObjectStore } from "./storage";

const { db, close } = testDb();
const database = db as unknown as Database;
let store: MemoryStore;

beforeAll(async () => {
  await acquireSuiteLock(db);
});

beforeEach(async () => {
  await truncateAll(db);
  store = new MemoryStore();
  useObjectStore(store);
});

afterEach(() => {
  useObjectStore(null);
});

afterAll(async () => {
  await releaseSuiteLock(db);
  await close();
});

const bytes = (text: string) => new TextEncoder().encode(text);

async function aTenant() {
  return createTenant(database, "Anwar Hossain");
}

describe("uploading", () => {
  it("puts the bytes in storage and the details in the database", async () => {
    const tenant = await aTenant();
    const doc = await saveDocument(database, tenant.id, {
      name: "lease.pdf",
      contentType: "application/pdf",
      bytes: bytes("%PDF-1.4"),
    });

    expect(doc.name).toBe("lease.pdf");
    expect(store.objects.has(doc.objectKey)).toBe(true);
    expect(await listDocuments(database, tenant.id)).toHaveLength(1);
  });

  it("refuses a file over the size cap without writing anything", async () => {
    const tenant = await aTenant();
    await expect(
      saveDocument(database, tenant.id, {
        name: "huge.pdf",
        contentType: "application/pdf",
        bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1),
      }),
    ).rejects.toThrow(UploadTooLarge);
    expect(store.objects.size).toBe(0);
  });

  it("replaces a photo rather than accumulating them", async () => {
    const tenant = await aTenant();
    const first = await saveDocument(
      database,
      tenant.id,
      { name: "old.jpg", contentType: "image/jpeg", bytes: bytes("one") },
      "photo",
    );
    const second = await saveDocument(
      database,
      tenant.id,
      { name: "new.jpg", contentType: "image/jpeg", bytes: bytes("two") },
      "photo",
    );

    expect((await photoFor(database, tenant.id))?.id).toBe(second.id);
    expect(store.objects.has(first.objectKey)).toBe(false);
    expect(await listDocuments(database, tenant.id)).toHaveLength(1);
  });

  it("refuses a tenant that does not exist", async () => {
    await expect(
      saveDocument(database, 9_999, { name: "x.pdf", contentType: "application/pdf", bytes: bytes("x") }),
    ).rejects.toThrow(NotFound);
  });
});

describe("serving", () => {
  it("streams a PDF inline with sniffing turned off", async () => {
    const tenant = await aTenant();
    const doc = await saveDocument(database, tenant.id, {
      name: "lease.pdf",
      contentType: "application/pdf",
      bytes: bytes("%PDF-1.4"),
    });

    const { headers } = await openDocument(database, doc.id);
    expect(headers.get("Content-Type")).toBe("application/pdf");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Content-Disposition")).toContain("inline");
    expect(headers.get("Cache-Control")).toContain("no-store");
  });

  it("forces an SVG to download rather than run on this origin", async () => {
    const tenant = await aTenant();
    const doc = await saveDocument(database, tenant.id, {
      name: "sneaky.svg",
      contentType: "image/svg+xml",
      bytes: bytes("<svg onload=\"alert(1)\"/>"),
    });

    const { headers } = await openDocument(database, doc.id);
    expect(headers.get("Content-Type")).toBe("application/octet-stream");
    expect(headers.get("Content-Disposition")).toContain("attachment");
  });

  it("forces an HTML upload to download too", async () => {
    const tenant = await aTenant();
    const doc = await saveDocument(database, tenant.id, {
      name: "page.html",
      contentType: "text/html",
      bytes: bytes("<script>alert(1)</script>"),
    });
    const { headers } = await openDocument(database, doc.id);
    expect(headers.get("Content-Disposition")).toContain("attachment");
  });

  it("returns the bytes that were stored", async () => {
    const tenant = await aTenant();
    const doc = await saveDocument(database, tenant.id, {
      name: "note.pdf",
      contentType: "application/pdf",
      bytes: bytes("hello"),
    });
    const { stream } = await openDocument(database, doc.id);
    const read = await new Response(stream).text();
    expect(read).toBe("hello");
  });

  it("refuses an id that does not exist rather than guessing", async () => {
    await expect(openDocument(database, 9_999)).rejects.toThrow(NotFound);
  });

  it("refuses a row whose object has vanished from storage", async () => {
    const tenant = await aTenant();
    const doc = await saveDocument(database, tenant.id, {
      name: "gone.pdf",
      contentType: "application/pdf",
      bytes: bytes("x"),
    });
    store.objects.clear();
    await expect(openDocument(database, doc.id)).rejects.toThrow(NotFound);
  });
});

describe("removing", () => {
  it("takes the row and the object together", async () => {
    const tenant = await aTenant();
    const doc = await saveDocument(database, tenant.id, {
      name: "lease.pdf",
      contentType: "application/pdf",
      bytes: bytes("x"),
    });

    await removeDocument(database, doc.id);
    expect(store.objects.size).toBe(0);
    expect(await listDocuments(database, tenant.id)).toHaveLength(0);
  });

  it("takes a tenant's files with them when the tenant goes", async () => {
    const tenant = await aTenant();
    await saveDocument(database, tenant.id, {
      name: "lease.pdf",
      contentType: "application/pdf",
      bytes: bytes("x"),
    });
    await saveDocument(
      database,
      tenant.id,
      { name: "face.png", contentType: "image/png", bytes: bytes("y") },
      "photo",
    );
    expect(store.objects.size).toBe(2);

    await deleteTenant(database, tenant.id);

    expect(await db.select().from(documents)).toHaveLength(0);
    /*
     * The rows cascade on their own; the objects do not. Without this the
     * bucket keeps paying for bytes nothing can name or reach.
     */
    expect(store.objects.size).toBe(0);
  });

  it("leaves the files alone when the tenant cannot be deleted", async () => {
    const tenant = await aTenant();
    const unit = await createUnit(database, "F1(B)", "back");
    await createTenancy(database, {
      unitId: unit.id,
      tenantId: tenant.id,
      start: { year: 2026, month: 1 },
      end: null,
      expectedRent: 6000,
    });
    await saveDocument(database, tenant.id, {
      name: "lease.pdf",
      contentType: "application/pdf",
      bytes: bytes("x"),
    });

    await expect(deleteTenant(database, tenant.id)).rejects.toBeInstanceOf(StillReferenced);

    /* The delete was refused, so the tenant still holds their documents. */
    expect(await listDocuments(database, tenant.id)).toHaveLength(1);
    expect(store.objects.size).toBe(1);
  });
});
