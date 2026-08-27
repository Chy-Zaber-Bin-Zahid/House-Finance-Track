"use client";

import { useRef, useState } from "react";
import { useInvalidate } from "@/components/hooks";
import { ImageFileIcon } from "@/components/icons";
import { api, ApiError, type StoredDocument } from "@/lib/api";
import { cn } from "@/lib/cn";

/**
 * A tenant's photo. The bytes go to object storage and come back through the
 * app, so the src is an application route and never a bucket URL.
 */
export function ImageSlot({
  tenantId,
  photo,
  editable,
  className,
  placeholder = "Drop a photo here",
}: {
  tenantId: number;
  photo: StoredDocument | null;
  editable: boolean;
  className?: string;
  placeholder?: string;
}) {
  const invalidate = useInvalidate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function accept(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That is not an image.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("tenantId", String(tenantId));
      form.set("kind", "photo");
      await api("/api/files", { method: "POST", body: form });
      invalidate("documents");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That upload did not work.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!photo) return;
    setBusy(true);
    try {
      await api(`/api/files/${photo.id}`, { method: "DELETE" });
      invalidate("documents");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove that photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("relative overflow-hidden bg-chip", className)}>
      <button
        type="button"
        disabled={!editable || busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          if (!editable) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (!editable) return;
          e.preventDefault();
          setDragging(false);
          void accept(e.dataTransfer.files[0]);
        }}
        aria-label={photo ? "Replace this photo" : placeholder}
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center transition-colors",
          editable ? "cursor-pointer" : "cursor-default",
          "focus-visible:outline-2 focus-visible:outline-brand focus-visible:-outline-offset-2",
          dragging && "bg-brand-wash ring-2 ring-brand ring-inset",
        )}
      >
        {photo ? (
          /* Served by a route that re-checks the session, so next/image cannot help here. */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/files/${photo.id}`} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <ImageFileIcon className="size-6 text-muted-2" />
            <span className="text-[13px] font-medium text-muted">
              {editable ? placeholder : "No photo"}
            </span>
            {editable ? (
              <span className="text-xs text-muted-2">Drop a file, or click to browse</span>
            ) : null}
          </>
        )}
      </button>

      {photo && editable ? (
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="absolute top-2 right-2 z-10 cursor-pointer rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-ink shadow-card backdrop-blur-sm hover:bg-white"
        >
          Remove
        </button>
      ) : null}

      {error ? (
        <p className="absolute inset-x-0 bottom-0 z-10 bg-amber-tint px-3 py-1.5 text-center text-xs text-amber-ink">
          {error}
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
