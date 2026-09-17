"use client";

import { createContext, useContext } from "react";
import { bagItemKey, type BagItem } from "@/lib/bag";
import { useHydrated } from "@/lib/hooks/useHydrated";
import {
  createPersistedStore,
  usePersistedStore,
} from "@/lib/store/persistedStore";

const bagStore = createPersistedStore<BagItem[]>("northline.bag", []);

type BagContextValue = {
  items: BagItem[];
  hydrated: boolean;
  addItem: (productId: string, size: string) => void;
  removeItem: (productId: string, size: string) => void;
  setQuantity: (productId: string, size: string, quantity: number) => void;
  clear: () => void;
};

const BagContext = createContext<BagContextValue | null>(null);

function addItem(productId: string, size: string) {
  const key = bagItemKey({ productId, size });
  bagStore.update((current) => {
    const existing = current.find((item) => bagItemKey(item) === key);
    if (existing) {
      return current.map((item) =>
        bagItemKey(item) === key
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      );
    }
    return [...current, { productId, size, quantity: 1 }];
  });
}

function removeItem(productId: string, size: string) {
  const key = bagItemKey({ productId, size });
  bagStore.update((current) =>
    current.filter((item) => bagItemKey(item) !== key),
  );
}

function setQuantity(productId: string, size: string, quantity: number) {
  if (quantity < 1) {
    removeItem(productId, size);
    return;
  }
  const key = bagItemKey({ productId, size });
  bagStore.update((current) =>
    current.map((item) =>
      bagItemKey(item) === key ? { ...item, quantity } : item,
    ),
  );
}

function clear() {
  bagStore.set([]);
}

export function BagProvider({ children }: { children: React.ReactNode }) {
  const items = usePersistedStore(bagStore);
  const hydrated = useHydrated();

  return (
    <BagContext.Provider
      value={{ items, hydrated, addItem, removeItem, setQuantity, clear }}
    >
      {children}
    </BagContext.Provider>
  );
}

export function useBag() {
  const context = useContext(BagContext);
  if (!context) {
    throw new Error("useBag must be used inside BagProvider");
  }
  return context;
}
