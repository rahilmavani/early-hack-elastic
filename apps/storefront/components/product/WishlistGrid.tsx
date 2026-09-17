"use client";

import { ProductGrid } from "@/components/product/ProductGrid";
import { getProducts } from "@/lib/catalogue";
import { useWishlist } from "@/lib/store/WishlistProvider";

export function WishlistGrid() {
  const wishlist = useWishlist();

  if (!wishlist.hydrated) {
    return null;
  }

  const products = getProducts().filter((product) => wishlist.has(product.id));

  return <ProductGrid products={products} emptyMessage="Nothing saved yet." />;
}
