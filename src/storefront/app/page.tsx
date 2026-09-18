import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Hero } from "@/components/home/Hero";
import { CategoryTiles } from "@/components/home/CategoryTiles";
import { ProductGrid } from "@/components/product/ProductGrid";
import { getNewArrivals } from "@/lib/catalogue";

export default function HomePage() {
  const newArrivals = getNewArrivals(8);

  return (
    <main>
      <Container className="py-10 md:py-16">
        <Hero />
      </Container>

      <Container className="py-10">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">
          Shop by category
        </h2>
        <CategoryTiles />
      </Container>

      <Container className="py-10">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">
            New arrivals
          </h2>
          <Link
            href="/c/women?sort=newest"
            className="text-ink-muted hover:text-ink text-sm"
          >
            View all
          </Link>
        </div>
        <ProductGrid products={newArrivals} />
      </Container>
    </main>
  );
}
