import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/data/products";
import { PriceTag } from "@/components/product/PriceTag";

type ProductCardProps = {
  product: Product;
  priority?: boolean;
};

export function ProductCard({ product, priority = false }: ProductCardProps) {
  return (
    <Link href={`/p/${product.slug}`} className="group block">
      <div className="bg-canvas-muted relative aspect-[3/4] overflow-hidden">
        <Image
          src={product.images[0]}
          alt={`${product.brand} ${product.name}`}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {product.isNew && (
          <span className="bg-canvas absolute top-2 left-2 px-2 py-0.5 text-[11px] font-medium tracking-wide">
            New
          </span>
        )}
        <div className="bg-canvas/95 text-ink-muted absolute inset-x-0 bottom-0 translate-y-full px-3 py-2 text-xs transition-transform duration-300 group-hover:translate-y-0">
          Sizes: {product.sizes.join(", ")}
        </div>
      </div>

      <div className="mt-3 space-y-0.5">
        <p className="text-sm font-semibold">{product.brand}</p>
        <p className="text-ink-muted truncate text-sm">{product.name}</p>
        <PriceTag
          price={product.price}
          compareAtPrice={product.compareAtPrice}
        />
      </div>
    </Link>
  );
}
