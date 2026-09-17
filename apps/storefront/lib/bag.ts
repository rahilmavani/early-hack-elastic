import type { Product } from "@/data/products";
import type { DeliveryMethod } from "@/lib/checkout";
import { getProducts } from "@/lib/catalogue";

export type BagItem = {
  productId: string;
  size: string;
  quantity: number;
};

export type BagLine = BagItem & {
  product: Product;
};

export const freeDeliveryThreshold = 1499;
export const standardDeliveryFee = 99;
export const expressDeliveryFee = 249;

export function bagItemKey(item: Pick<BagItem, "productId" | "size">) {
  return `${item.productId}:${item.size}`;
}

export function resolveBagLines(items: BagItem[]): BagLine[] {
  const products = getProducts();
  const lines: BagLine[] = [];

  for (const item of items) {
    const product = products.find(
      (candidate) => candidate.id === item.productId,
    );
    if (product) {
      lines.push({ ...item, product });
    }
  }

  return lines;
}

export function deliveryFeeFor(subtotal: number, method: DeliveryMethod) {
  if (subtotal === 0) {
    return 0;
  }
  if (method === "express") {
    return expressDeliveryFee;
  }
  return subtotal >= freeDeliveryThreshold ? 0 : standardDeliveryFee;
}

export function bagTotals(
  lines: BagLine[],
  method: DeliveryMethod = "standard",
) {
  const subtotal = lines.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0,
  );
  const delivery = deliveryFeeFor(subtotal, method);
  return { subtotal, delivery, total: subtotal + delivery };
}

export function bagItemCount(items: BagItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
