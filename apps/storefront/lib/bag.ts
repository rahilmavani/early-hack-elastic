import type { Product } from "@/data/products";
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
export const deliveryFee = 99;

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

export function bagTotals(lines: BagLine[]) {
  const subtotal = lines.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0,
  );
  const delivery =
    subtotal === 0 || subtotal >= freeDeliveryThreshold ? 0 : deliveryFee;
  return { subtotal, delivery, total: subtotal + delivery };
}

export function bagItemCount(items: BagItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
