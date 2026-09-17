import type { ProductFilters, SortKey } from "@/lib/catalogue";

export type SearchParams = Record<string, string | string[] | undefined>;

export const sortOptions: { value: SortKey; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

export const priceCeilings = [2000, 5000, 10000];

function toList(value: string | string[] | undefined) {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function toSortKey(value: string | string[] | undefined): SortKey {
  const match = sortOptions.find((option) => option.value === value);
  return match ? match.value : "recommended";
}

export function parseListingParams(searchParams: SearchParams) {
  const maxPrice = Number(searchParams.maxPrice);

  const filters: ProductFilters = {
    brands: toList(searchParams.brand),
    sizes: toList(searchParams.size),
    colours: toList(searchParams.colour),
    maxPrice: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : undefined,
  };

  return { filters, sort: toSortKey(searchParams.sort) };
}
