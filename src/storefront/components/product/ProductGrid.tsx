import type { Product } from "@/data/products";
import { ProductCard } from "@/components/product/ProductCard";

type ProductGridProps = {
  products: Product[];
  emptyMessage?: string;
};

export function ProductGrid({
  products,
  emptyMessage = "No products found.",
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <p className="text-ink-muted py-16 text-center text-sm">{emptyMessage}</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={index < 4} />
      ))}
    </div>
  );
}
