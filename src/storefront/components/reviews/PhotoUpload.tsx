"use client";

import { useRef } from "react";
import Image from "next/image";
import { Camera, Check, X } from "lucide-react";
import { maxPhotoBytes } from "@/lib/reviews";

type PhotoUploadProps = {
  photo: string | null;
  onChange: (photo: string | null) => void;
  onError: (message: string) => void;
};

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function PhotoUpload({ photo, onChange, onError }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (file.size > maxPhotoBytes) {
      onError("Photos need to be under 2 MB.");
      event.target.value = "";
      return;
    }
    try {
      onChange(await readAsDataUrl(file));
    } catch {
      onError("We couldn't read that file.");
    }
  }

  function handleRemove() {
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div>
      <p className="text-ink-muted mb-1.5 block text-xs font-medium">
        Add a photo (optional)
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="sr-only"
        id="review-photo"
      />

      {photo ? (
        <div className="flex items-center gap-3">
          <div className="bg-canvas-muted relative size-16 overflow-hidden">
            <Image
              src={photo}
              alt="Selected photo"
              fill
              unoptimized
              className="object-cover"
            />
          </div>
          <span className="text-success inline-flex items-center gap-1 text-sm">
            <Check size={14} /> Uploaded
          </span>
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove photo"
            className="text-ink-muted hover:text-ink p-1"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <label
          htmlFor="review-photo"
          className="border-line hover:border-ink inline-flex h-10 cursor-pointer items-center gap-2 border px-4 text-sm"
        >
          <Camera size={16} strokeWidth={1.5} />
          Choose photo
        </label>
      )}
    </div>
  );
}
