"use client";

import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";

async function fileToDataUrl(
  file: File,
  maxWidth = 1200,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

type SingleProps = {
  label: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  hint?: string;
};

export function ImagePicker({ label, value, onChange, hint }: SingleProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file, 800, 0.8);
      onChange(dataUrl);
    } catch {
      alert("Could not process that image");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border border-dashed border-[var(--border)] bg-white text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          style={
            value
              ? {
                  backgroundImage: `url(${value})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {!value && (
            <>
              <ImagePlus className="h-5 w-5" />
              <span className="text-[10px] font-medium">Gallery</span>
            </>
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <p className="text-xs text-[var(--muted)]">
            {hint || "Choose a photo from your gallery"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost ring-1 ring-[var(--border)] text-sm"
              onClick={() => inputRef.current?.click()}
            >
              {value ? "Change photo" : "Select from gallery"}
            </button>
            {value && (
              <button
                type="button"
                className="btn-danger text-sm"
                onClick={() => onChange(null)}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
    </div>
  );
}

type MultiProps = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  max?: number;
};

export function MultiImagePicker({
  label,
  values,
  onChange,
  max = 6,
}: MultiProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    const remaining = max - values.length;
    if (remaining <= 0) {
      alert(`You can add up to ${max} images`);
      return;
    }
    const selected = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, remaining);
    try {
      const urls = await Promise.all(
        selected.map((f) => fileToDataUrl(f, 1200, 0.72))
      );
      onChange([...values, ...urls]);
    } catch {
      alert("Could not process one or more images");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="label">{label}</label>
      <p className="mb-2 text-xs text-[var(--muted)]">
        Select photos from your gallery ({values.length}/{max})
      </p>
      <div className="flex flex-wrap gap-3">
        {values.map((src, i) => (
          <div
            key={`${i}-${src.slice(0, 32)}`}
            className="relative h-24 w-24 overflow-hidden rounded-xl bg-stone-200"
            style={{
              backgroundImage: `url(${src})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <button
              type="button"
              aria-label="Remove image"
              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {values.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border)] bg-white text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <ImagePlus className="h-5 w-5" />
            <span className="text-[10px] font-medium">Add</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
    </div>
  );
}
