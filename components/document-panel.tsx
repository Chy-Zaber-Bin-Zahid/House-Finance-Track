"use client";

import { useRef, useState } from "react";
import { useHouse } from "@/components/house-store";
import { DocFileIcon, ImageFileIcon, UploadIcon } from "@/components/icons";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { countLabel, fileKind, formatBytes } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/seed";
import type { DocumentFile, Unit } from "@/lib/types";

/** Above this, only the file's details are kept — the bytes will not fit. */
const MAX_STORED_BYTES = 1_500_000;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = head.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const bytes = atob(body);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) buffer[i] = bytes.charCodeAt(i);
  return new Blob([buffer], { type: mime });
}

function openDoc(doc: DocumentFile) {
  if (!doc.dataUrl) return;
  const url = URL.createObjectURL(dataUrlToBlob(doc.dataUrl));
  window.open(url, "_blank", "noopener");
  /* The tab has the bytes by now; hold the handle just long enough for it. */
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function toDocument(file: File, id: string): Promise<DocumentFile> {
  const today = new Date();
  return {
    id,
    name: file.name,
    meta: `${fileKind(file.type, file.name)} · ${formatBytes(file.size)}`,
    image: file.type.startsWith("image/"),
    added: MONTH_NAMES[today.getMonth()].slice(0, 3),
    dataUrl: file.size <= MAX_STORED_BYTES ? await readAsDataUrl(file) : undefined,
  };
}

export function DocumentPanel({ unit }: { unit: Unit }) {
  const { dispatch } = useHouse();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function accept(files: FileList | null) {
    if (!files || files.length === 0) return;
    const docs = await Promise.all(
      Array.from(files).map((file, i) =>
        toDocument(file, `${unit.key}-${Date.now()}-${i}`),
      ),
    );
    dispatch({ type: "addDocs", unitKey: unit.key, docs });
  }

  return (
    <Card className="px-[22px] pt-[19px] pb-[22px]">
      <div className="mb-1.5 flex items-baseline gap-2.5">
        <h2 className="text-[17px] font-semibold">Documents</h2>
        <span className="text-[13px] text-muted-2">
          {unit.docs.length === 0 ? "None yet" : countLabel(unit.docs.length, "file", "files")} ·
          only you can see these
        </span>
      </div>

      <button
        type="button"
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
          dragging ? "border-brand bg-brand-wash" : "border-line-16 bg-white hover:border-brand hover:bg-brand-wash",
        )}
      >
        <UploadIcon className="mx-auto mb-[11px] size-[26px] text-brand" />
        <span className="mb-1 block text-[15px] font-semibold">Drop a document here</span>
        <span className="block text-[13px] text-muted">
          Agreement, ID, meter photo — PDF, JPG or PNG
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

      {unit.docs.length === 0 ? (
        <p className="px-0.5 pt-3.5 text-[13px] text-muted-2">
          Nothing uploaded for this unit yet.
        </p>
      ) : (
        <ul className="mt-1.5 flex flex-col">
          {unit.docs.map((doc, i) => (
            <li
              key={doc.id}
              className={cn(
                "flex items-center gap-[13px] px-0.5 py-3",
                i < unit.docs.length - 1 && "border-b border-line-6",
              )}
            >
              <span
                aria-hidden="true"
                className="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-chip text-slate"
              >
                {doc.image ? <ImageFileIcon /> : <DocFileIcon />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{doc.name}</div>
                <div className="text-[12.5px] text-muted-2">
                  {doc.meta} · added {doc.added}
                </div>
              </div>
              <Button
                className="px-3 py-1.5 text-[13px]"
                disabled={!doc.dataUrl}
                title={doc.dataUrl ? undefined : "Only this file's details are stored on this device."}
                onClick={() => openDoc(doc)}
              >
                Open
              </Button>
              <Button
                className="px-3 py-1.5 text-[13px] text-muted"
                onClick={() => dispatch({ type: "removeDoc", unitKey: unit.key, docId: doc.id })}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
