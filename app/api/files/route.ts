import { requireApproved, requireEditor } from "@/data/guard";
import { currentActor, toResponse } from "@/data/http";
import { listDocuments, MAX_UPLOAD_BYTES, saveDocument, UploadTooLarge } from "@/data/files";
import { db } from "@/db/client";

export async function GET(request: Request) {
  try {
    requireApproved(await currentActor());
    const tenantId = Number(new URL(request.url).searchParams.get("tenantId"));
    if (!Number.isInteger(tenantId)) {
      return Response.json({ error: "Which tenant?" }, { status: 400 });
    }
    return Response.json({ documents: await listDocuments(db, tenantId) });
  } catch (error) {
    return toResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireEditor(await currentActor());

    const form = await request.formData();
    const file = form.get("file");
    const tenantId = Number(form.get("tenantId"));
    const kind = form.get("kind") === "photo" ? "photo" : "document";

    if (!(file instanceof File)) return Response.json({ error: "No file was sent." }, { status: 400 });
    if (!Number.isInteger(tenantId)) return Response.json({ error: "Which tenant?" }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json({ error: "That file is larger than 10 MB." }, { status: 413 });
    }

    const document = await saveDocument(
      db,
      tenantId,
      {
        name: file.name,
        /* The browser's claim about type is not trusted for rendering; openDocument decides. */
        contentType: file.type || "application/octet-stream",
        bytes: new Uint8Array(await file.arrayBuffer()),
      },
      kind,
    );

    return Response.json({ document }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadTooLarge) {
      return Response.json({ error: error.message }, { status: 413 });
    }
    return toResponse(error);
  }
}
