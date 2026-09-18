"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";

type ImageGalleryProps = {
  images: string[];
  alt: string;
};

export function ImageGallery({ images, alt }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row">
      <div className="flex gap-3 md:flex-col">
        {images.map((image, index) => (
          <button
            key={image}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={`View image ${index + 1}`}
            className={cn(
              "bg-canvas-muted relative aspect-[3/4] w-16 overflow-hidden border",
              index === activeIndex ? "border-ink" : "border-transparent",
            )}
          >
            <Image
              src={image}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      <div className="bg-canvas-muted relative aspect-[3/4] flex-1 overflow-hidden">
        <Image
          src={images[activeIndex]}
          alt={alt}
          fill
          priority
          sizes="(min-width: 1024px) 45vw, 100vw"
          className="object-cover"
        />
      </div>
    </div>
  );
}
