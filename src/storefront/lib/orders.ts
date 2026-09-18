import type { DeliveryMethod } from "@/lib/checkout";

export type OrderItem = {
  productId: string;
  size: string;
  quantity: number;
  unitPrice: number;
};

export type OrderAddress = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
};

export type OrderRequest = {
  items: OrderItem[];
  email: string;
  phone: string;
  address: OrderAddress;
  delivery: DeliveryMethod;
  cardLast4: string;
};

export type Order = OrderRequest & {
  id: string;
  createdAt: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
};

export function createOrderId() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const random = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `NL-${stamp}${random}`;
}
