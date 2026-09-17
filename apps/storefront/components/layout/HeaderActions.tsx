"use client";

import Link from "next/link";
import { Heart, Search, ShoppingBag } from "lucide-react";
import { bagItemCount } from "@/lib/bag";
import { useBag } from "@/lib/store/BagProvider";
import { useWishlist } from "@/lib/store/WishlistProvider";

type CountBadgeProps = {
  count: number;
};

function CountBadge({ count }: CountBadgeProps) {
  if (count === 0) {
    return null;
  }
  return (
    <span className="bg-ink absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-medium text-white">
      {count}
    </span>
  );
}

export function HeaderActions() {
  const bag = useBag();
  const wishlist = useWishlist();

  return (
    <div className="flex items-center gap-4">
      <Link href="/search" aria-label="Search" className="p-1 md:hidden">
        <Search size={20} strokeWidth={1.5} />
      </Link>
      <Link href="/wishlist" aria-label="Wishlist" className="relative p-1">
        <Heart size={20} strokeWidth={1.5} />
        <CountBadge count={wishlist.productIds.length} />
      </Link>
      <Link href="/bag" aria-label="Bag" className="relative p-1">
        <ShoppingBag size={20} strokeWidth={1.5} />
        <CountBadge count={bagItemCount(bag.items)} />
      </Link>
    </div>
  );
}
