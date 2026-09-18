export type CategorySlug = "men" | "women" | "footwear" | "accessories";

export type Category = {
  slug: CategorySlug;
  name: string;
  tagline: string;
};

export const categories: Category[] = [
  { slug: "men", name: "Men", tagline: "Everyday essentials, cut clean." },
  { slug: "women", name: "Women", tagline: "Quiet shapes for loud days." },
  { slug: "footwear", name: "Footwear", tagline: "Built for the long walk." },
  {
    slug: "accessories",
    name: "Accessories",
    tagline: "The finishing details.",
  },
];

export function getCategory(slug: string) {
  return categories.find((category) => category.slug === slug);
}
