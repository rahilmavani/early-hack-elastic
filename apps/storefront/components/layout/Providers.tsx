"use client";

import { BagProvider } from "@/lib/store/BagProvider";
import { OrdersProvider } from "@/lib/store/OrdersProvider";
import { WishlistProvider } from "@/lib/store/WishlistProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BagProvider>
      <WishlistProvider>
        <OrdersProvider>{children}</OrdersProvider>
      </WishlistProvider>
    </BagProvider>
  );
}
