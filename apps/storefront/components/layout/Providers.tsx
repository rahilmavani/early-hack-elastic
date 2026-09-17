"use client";

import { BagProvider } from "@/lib/store/BagProvider";
import { WishlistProvider } from "@/lib/store/WishlistProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BagProvider>
      <WishlistProvider>{children}</WishlistProvider>
    </BagProvider>
  );
}
