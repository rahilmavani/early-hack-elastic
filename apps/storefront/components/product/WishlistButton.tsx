"use client";

import { Heart } from "lucide-react";
import { useWishlist } from "@/lib/store/WishlistProvider";
import { cn } from "@/lib/cn";

type WishlistButtonProps = {
  productId: string;
  variant?: "icon" | "labelled";
};

export function WishlistButton({
  productId,
  variant = "icon",
}: WishlistButtonProps) {
  const wishlist = useWishlist();
  const active = wishlist.has(productId);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    wishlist.toggle(productId);
  }

  if (variant === "labelled") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={active}
        className="border-ink hover:bg-canvas-muted inline-flex h-12 items-center justify-center gap-2 border px-6 text-sm font-medium tracking-wide transition-colors"
      >
        <Heart
          size={16}
          strokeWidth={1.5}
          className={cn(active && "fill-ink")}
        />
        {active ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={active}
      className="bg-canvas/90 absolute top-2 right-2 flex size-8 items-center justify-center rounded-full"
    >
      <Heart size={16} strokeWidth={1.5} className={cn(active && "fill-ink")} />
    </button>
  );
}
