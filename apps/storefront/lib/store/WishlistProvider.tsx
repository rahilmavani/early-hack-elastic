"use client";

import { createContext, useContext } from "react";
import { useHydrated } from "@/lib/hooks/useHydrated";
import {
  createPersistedStore,
  usePersistedStore,
} from "@/lib/store/persistedStore";

const wishlistStore = createPersistedStore<string[]>("northline.wishlist", []);

type WishlistContextValue = {
  productIds: string[];
  hydrated: boolean;
  has: (productId: string) => boolean;
  toggle: (productId: string) => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

function toggle(productId: string) {
  wishlistStore.update((current) =>
    current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId],
  );
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const productIds = usePersistedStore(wishlistStore);
  const hydrated = useHydrated();

  function has(productId: string) {
    return productIds.includes(productId);
  }

  return (
    <WishlistContext.Provider value={{ productIds, hydrated, has, toggle }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used inside WishlistProvider");
  }
  return context;
}
