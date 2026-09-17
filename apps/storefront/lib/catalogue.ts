import type { CategorySlug } from "@/data/categories";
import { products, type Product } from "@/data/products";

export type SortKey = "recommended" | "newest" | "price-asc" | "price-desc";

export type ProductFilters = {
  category?: CategorySlug;
  brands?: string[];
  sizes?: string[];
  colours?: string[];
  maxPrice?: number;
};

export function getProducts() {
  return products;
}

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getNewArrivals(limit: number) {
  return products.filter((product) => product.isNew).slice(0, limit);
}

export function getRelatedProducts(product: Product, limit: number) {
  return products
    .filter(
      (candidate) =>
        candidate.category === product.category && candidate.id !== product.id,
    )
    .slice(0, limit);
}

export function filterProducts(filters: ProductFilters) {
  return products.filter((product) => {
    if (filters.category && product.category !== filters.category) {
      return false;
    }
    if (filters.brands?.length && !filters.brands.includes(product.brand)) {
      return false;
    }
    if (
      filters.sizes?.length &&
      !product.sizes.some((size) => filters.sizes?.includes(size))
    ) {
      return false;
    }
    if (
      filters.colours?.length &&
      !filters.colours.includes(product.colour.name)
    ) {
      return false;
    }
    if (filters.maxPrice !== undefined && product.price > filters.maxPrice) {
      return false;
    }
    return true;
  });
}

export function sortProducts(list: Product[], sort: SortKey) {
  const sorted = [...list];

  if (sort === "price-asc") {
    sorted.sort((a, b) => a.price - b.price);
  } else if (sort === "price-desc") {
    sorted.sort((a, b) => b.price - a.price);
  } else if (sort === "newest") {
    sorted.sort((a, b) => Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)));
  }

  return sorted;
}

export function searchProducts(query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return [];
  }

  return products.filter((product) => {
    const haystack = [
      product.name,
      product.brand,
      product.category,
      product.colour.name,
      product.description,
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function uniqueValues(
  list: Product[],
  pick: (product: Product) => string | string[],
) {
  const values = new Set<string>();
  for (const product of list) {
    const picked = pick(product);
    if (Array.isArray(picked)) {
      picked.forEach((value) => values.add(value));
    } else {
      values.add(picked);
    }
  }
  return [...values];
}
