import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { FilterRail } from "@/components/listing/FilterRail";
import { SortSelect } from "@/components/listing/SortSelect";
import { ProductGrid } from "@/components/product/ProductGrid";
import { categories, getCategory } from "@/data/categories";
import { filterProducts, sortProducts, uniqueValues } from "@/lib/catalogue";
import { parseListingParams } from "@/lib/listing";

export function generateStaticParams() {
  return categories.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/c/[category]">): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getCategory(slug);
  return { title: category ? category.name : "Not found" };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/c/[category]">) {
  const { category: slug } = await params;
  const category = getCategory(slug);
  if (!category) {
    notFound();
  }

  const { filters, sort } = parseListingParams(await searchParams);
  const categoryProducts = filterProducts({ category: category.slug });
  const visibleProducts = sortProducts(
    filterProducts({ ...filters, category: category.slug }),
    sort,
  );

  const options = {
    brands: uniqueValues(categoryProducts, (product) => product.brand).sort(),
    sizes: uniqueValues(categoryProducts, (product) => product.sizes),
    colours: uniqueValues(
      categoryProducts,
      (product) => product.colour.name,
    ).sort(),
  };

  return (
    <main>
      <Container className="py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {category.name}
            </h1>
            <p className="text-ink-muted mt-1 text-sm">
              {visibleProducts.length}{" "}
              {visibleProducts.length === 1 ? "item" : "items"}
            </p>
          </div>
          <SortSelect value={sort} />
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
          <FilterRail filters={filters} options={options} />
          <div className="flex-1">
            <ProductGrid
              products={visibleProducts}
              emptyMessage="Nothing matches those filters."
            />
          </div>
        </div>
      </Container>
    </main>
  );
}
