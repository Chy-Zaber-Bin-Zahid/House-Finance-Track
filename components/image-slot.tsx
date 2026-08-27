"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageFileIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

const MAX_EDGE = 1024;
const KEEP_AS_IS_BELOW = 600_000;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file could not be read as an image."));
    img.src = src;
  });
}

/** Big photos are re-encoded so a year of them still fits in the browser's store. */
async function toStorableDataUrl(file: File): Promise<string> {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const longest = Math.max(img.width, img.height);
  if (longest <= MAX_EDGE && dataUrl.length < KEEP_AS_IS_BELOW) return dataUrl;

  const scale = Math.min(1, MAX_EDGE / longest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

/**
 * A picture you fill in yourself: drop a file on it, or click to browse.
 * What you drop stays put across reloads, kept per slot in this browser.
 */
export function ImageSlot({
  id,
  placeholder = "Drop a photo here",
  className,
}: {
  id: string;
  placeholder?: string;
  className?: string;
}) {
  const storageKey = `image-slot:${id}`;
  const [src, setSrc] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setSrc(window.localStorage.getItem(storageKey));
    } catch {
      setSrc(null);
    }
  }, [storageKey]);

  const accept = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("That is not an image.");
        return;
      }
      try {
        const dataUrl = await toStorableDataUrl(file);
        setSrc(dataUrl);
        setError(null);
        try {
          window.localStorage.setItem(storageKey, dataUrl);
        } catch {
          setError("Shown for now — this browser had no room to keep it.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "That file could not be read.");
      }
    },
    [storageKey],
  );

  function clear() {
    setSrc(null);
    setError(null);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* Nothing to clean up if the store is unavailable. */
    }
  }

  return (
    <div className={cn("relative overflow-hidden bg-chip", className)}>
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
          void accept(e.dataTransfer.files[0]);
        }}
        aria-label={src ? "Replace this photo" : placeholder}
        className={cn(
          "absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 p-4 text-center transition-colors",
          "focus-visible:outline-2 focus-visible:outline-brand focus-visible:-outline-offset-2",
          dragging && "bg-brand-wash ring-2 ring-brand ring-inset",
        )}
      >
        {src ? (
          /* A user-supplied data URL — next/image would only re-encode what is already sized. */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <ImageFileIcon className="size-6 text-muted-2" />
            <span className="text-[13px] font-medium text-muted">{placeholder}</span>
            <span className="text-xs text-muted-2">Drop a file, or click to browse</span>
          </>
        )}
      </button>

      {src ? (
        <button
          type="button"
          onClick={clear}
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
