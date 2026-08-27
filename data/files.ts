import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { documents, tenants } from "@/db/schema";
import { NotFound } from "./errors";
import { objectStore } from "./storage";

/** Above this an upload is refused rather than streamed anywhere. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * What may be rendered in the browser. Anything else is sent as an attachment.
 *
 * Serving files from the application's own origin is what makes this matter: an
 * uploaded SVG or HTML file returned inline would run as this app, with the
 * signed-in account's access. Tenant identity documents arrive from outside the
 * family, so this is the untrusted-input path.
 */
const INLINE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export class UploadTooLarge extends Error {
  constructor() {
    super("That file is larger than 10 MB.");
    this.name = "UploadTooLarge";
  }
}

export type StoredDocument = typeof documents.$inferSelect;

export async function listDocuments(db: Database, tenantId: number): Promise<StoredDocument[]> {
  return db
    .select()
    .from(documents)
    .where(eq(documents.tenantId, tenantId))
    .orderBy(asc(documents.createdAt));
}

export async function photoFor(db: Database, tenantId: number): Promise<StoredDocument | null> {
  const [row] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.tenantId, tenantId), eq(documents.kind, "photo")))
    .limit(1);
  return row ?? null;
}

export async function saveDocument(
  db: Database,
  tenantId: number,
  file: { name: string; contentType: string; bytes: Uint8Array },
  kind: "photo" | "document" = "document",
): Promise<StoredDocument> {
  if (file.bytes.byteLength > MAX_UPLOAD_BYTES) throw new UploadTooLarge();

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw new NotFound("No such tenant.");

  const objectKey = `tenants/${tenantId}/${kind}/${randomUUID()}`;
  await objectStore().put(objectKey, file.bytes, file.contentType);

  let row: StoredDocument;
  try {
    [row] = await db
      .insert(documents)
      .values({
        tenantId,
        kind,
        objectKey,
        /* Bounded so a hostile name cannot make its own row unservable. */
        name: file.name.slice(0, 255),
        contentType: file.contentType,
        size: file.bytes.byteLength,
      })
      .returning();
  } catch (error) {
    /*
     * The bytes are already stored. Without this they would sit in the bucket
     * forever with no row referencing them and nothing recording the leak.
     */
    await objectStore()
      .delete(objectKey)
      .catch(() => console.error("Orphaned object left in storage", { objectKey }));
    throw error;
  }

  /*
   * A photo replaces the previous one, and the replacement is stored before the
   * old one is removed. The other order loses the existing photo whenever the
   * upload fails, leaving the tenant with none at all.
   */
  if (kind === "photo") {
    const previous = await db
      .select()
      .from(documents)
      .where(and(eq(documents.tenantId, tenantId), eq(documents.kind, "photo")))
      .orderBy(asc(documents.id));
    for (const old of previous) {
      if (old.id !== row.id) await removeDocument(db, old.id);
    }
  }

  return row;
}

export async function removeDocument(db: Database, id: number): Promise<void> {
  const [row] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!row) throw new NotFound("No such file.");

  /*
   * The row goes first. A failure between the two then leaves bytes in the
   * bucket that nothing references - invisible and sweepable - rather than a
   * live row pointing at bytes that are gone, which surfaces to the user as a
   * file that is listed but will not open.
   */
  await db.delete(documents).where(eq(documents.id, id));
  await objectStore()
    .delete(row.objectKey)
    .catch(() => console.error("Object left in storage after its row was removed", { key: row.objectKey }));
}

/**
 * The bytes, plus the headers that make serving them safe. Never a bucket URL:
 * a link handed out would outlive the access of the account that fetched it.
 */
export async function openDocument(
  db: Database,
  id: number,
): Promise<{ stream: ReadableStream<Uint8Array>; headers: Headers }> {
  const [row] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!row) throw new NotFound("No such file.");

  const stream = await objectStore().get(row.objectKey);
  if (!stream) throw new NotFound("That file is no longer in storage.");

  const inline = INLINE_TYPES.has(row.contentType);
  const headers = new Headers({
    "Content-Type": inline ? row.contentType : "application/octet-stream",
    "Content-Length": String(row.size),
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${row.name.replace(/"/g, "")}"`,
    "Cache-Control": "private, no-store",
  });

  return { stream, headers };
}
