"use client";

import { createContext, useContext } from "react";
import type { Order } from "@/lib/orders";
import { useHydrated } from "@/lib/hooks/useHydrated";
import {
  createPersistedStore,
  usePersistedStore,
} from "@/lib/store/persistedStore";

const ordersStore = createPersistedStore<Order[]>("northline.orders", []);

type OrdersContextValue = {
  orders: Order[];
  hydrated: boolean;
  addOrder: (order: Order) => void;
  getOrder: (id: string) => Order | undefined;
};

const OrdersContext = createContext<OrdersContextValue | null>(null);

function addOrder(order: Order) {
  ordersStore.update((current) => [order, ...current]);
}

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const orders = usePersistedStore(ordersStore);
  const hydrated = useHydrated();

  function getOrder(id: string) {
    return orders.find((order) => order.id === id);
  }

  return (
    <OrdersContext.Provider value={{ orders, hydrated, addOrder, getOrder }}>
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error("useOrders must be used inside OrdersProvider");
  }
  return context;
}
