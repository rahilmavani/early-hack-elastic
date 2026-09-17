import type { Metadata } from "next";
import { Search } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { ProductGrid } from "@/components/product/ProductGrid";
import { searchProducts } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Search" };

function readQuery(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const query = readQuery((await searchParams).q).trim();
  const results = query ? searchProducts(query) : [];

  return (
    <main>
      <Container className="py-8">
        <form
          action="/search"
          method="get"
          role="search"
          className="relative mb-8 max-w-xl"
        >
          <label htmlFor="page-search" className="sr-only">
            Search
          </label>
          <Search
            size={18}
            strokeWidth={1.5}
            className="text-ink-muted pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
          />
          <input
            id="page-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search for products, brands and colours"
            autoComplete="off"
            autoFocus={!query}
            className="border-line focus:border-ink h-12 w-full border pr-4 pl-11 text-sm outline-none"
          />
        </form>

        {query && (
          <p className="text-ink-muted mb-6 text-sm">
            {results.length} {results.length === 1 ? "result" : "results"} for{" "}
            <span className="text-ink font-medium">&ldquo;{query}&rdquo;</span>
          </p>
        )}

        {query ? (
          <ProductGrid
            products={results}
            emptyMessage="No products match that search."
          />
        ) : (
          <p className="text-ink-muted text-sm">
            Try a product, a brand or a colour.
          </p>
        )}
      </Container>
    </main>
  );
}
