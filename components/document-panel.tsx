"use client";

import { useRef, useState } from "react";
import { useInvalidate } from "@/components/hooks";
import { DocFileIcon, ImageFileIcon, UploadIcon } from "@/components/icons";
import { Button, Card, Notice } from "@/components/ui";
import { api, ApiError, type StoredDocument } from "@/lib/api";
import { cn } from "@/lib/cn";
import { countLabel, formatBytes } from "@/lib/format";

export function DocumentPanel({
  tenantId,
  documents,
  editable,
}: {
  tenantId: number;
  documents: StoredDocument[];
  editable: boolean;
}) {
  const invalidate = useInvalidate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function accept(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);
        form.set("tenantId", String(tenantId));
        form.set("kind", "document");
        await api("/api/files", { method: "POST", body: form });
      }
      invalidate("documents");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That upload did not work.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    try {
      await api(`/api/files/${id}`, { method: "DELETE" });
      invalidate("documents");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove that file.");
    } finally {
      setBusy(false);
    }
  }

  const files = documents.filter((d) => d.kind === "document");

  return (
    <Card className="px-[22px] pt-[19px] pb-[22px]">
      <div className="mb-1.5 flex items-baseline gap-2.5">
        <h2 className="text-[17px] font-semibold">Documents</h2>
        <span className="text-[13px] text-muted-2">
          {files.length === 0 ? "None yet" : countLabel(files.length, "file", "files")} · only the
          family can see these
        </span>
      </div>

      {error ? (
        <div className="my-3">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      {editable ? (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void accept(e.dataTransfer.files);
            }}
            className={cn(
              "my-3.5 mb-1.5 w-full cursor-pointer rounded-tile border-[1.5px] border-dashed p-[26px] text-center transition-colors",
              "focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2",
              dragging
                ? "border-brand bg-brand-wash"
                : "border-line-16 bg-white hover:border-brand hover:bg-brand-wash",
            )}
          >
            <UploadIcon className="mx-auto mb-[11px] size-[26px] text-brand" />
            <span className="mb-1 block text-[15px] font-semibold">
              {busy ? "Uploading…" : "Drop a document here"}
            </span>
            <span className="block text-[13px] text-muted">
              Agreement, ID, meter photo — PDF, JPG or PNG, up to 10 MB
            </span>
          </button>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,image/*"
            className="hidden"
            onChange={(e) => {
              void accept(e.target.files);
              e.target.value = "";
            }}
          />
        </>
      ) : null}

      {files.length === 0 ? (
        <p className="px-0.5 pt-3.5 text-[13px] text-muted-2">Nothing uploaded for this tenant yet.</p>
      ) : (
        <ul className="mt-1.5 flex flex-col">
          {files.map((doc, i) => (
            <li
              key={doc.id}
              className={cn(
                "flex items-center gap-[13px] px-0.5 py-3",
                i < files.length - 1 && "border-b border-line-6",
              )}
            >
              <span
                aria-hidden="true"
                className="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-chip text-slate"
              >
                {doc.contentType.startsWith("image/") ? <ImageFileIcon /> : <DocFileIcon />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{doc.name}</div>
                <div className="text-[12.5px] text-muted-2">
                  {formatBytes(doc.size)} · added {new Date(doc.createdAt).toLocaleDateString()}
                </div>
              </div>
              <Button
                className="px-3 py-1.5 text-[13px]"
                onClick={() => window.open(`/api/files/${doc.id}`, "_blank", "noopener")}
              >
                Open
              </Button>
              {editable ? (
                <Button
                  className="px-3 py-1.5 text-[13px] text-muted"
                  disabled={busy}
                  onClick={() => remove(doc.id)}
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
