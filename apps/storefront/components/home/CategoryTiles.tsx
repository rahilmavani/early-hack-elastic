import Image from "next/image";
import Link from "next/link";
import { categories, type CategorySlug } from "@/data/categories";

const tileImages: Record<CategorySlug, string> = {
  men: "/products/chore-jacket-1.jpg",
  women: "/products/wide-leg-trousers-1.jpg",
  footwear: "/products/leather-chelsea-boot-1.jpg",
  accessories: "/products/canvas-tote-1.jpg",
};

export function CategoryTiles() {
  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={`/c/${category.slug}`}
          className="group block"
        >
          <div className="bg-canvas-muted relative aspect-[3/4] overflow-hidden">
            <Image
              src={tileImages[category.slug]}
              alt={category.name}
              fill
              sizes="(min-width: 1024px) 25vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </div>
          <p className="mt-3 text-sm font-semibold">{category.name}</p>
          <p className="text-ink-muted text-sm">{category.tagline}</p>
        </Link>
      ))}
    </section>
  );
}
