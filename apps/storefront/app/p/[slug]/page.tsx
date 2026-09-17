import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { ImageGallery } from "@/components/product/ImageGallery";
import { PriceTag } from "@/components/product/PriceTag";
import { ProductGrid } from "@/components/product/ProductGrid";
import { PurchasePanel } from "@/components/product/PurchasePanel";
import { Rating } from "@/components/product/Rating";
import { Accordion } from "@/components/ui/Accordion";
import {
  getProductBySlug,
  getProducts,
  getRelatedProducts,
} from "@/lib/catalogue";

export function generateStaticParams() {
  return getProducts().map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  return { title: product ? `${product.brand} ${product.name}` : "Not found" };
}

export default async function ProductPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) {
    notFound();
  }

  const related = getRelatedProducts(product, 4);

  return (
    <main>
      <Container className="py-8">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <ImageGallery
            images={product.images}
            alt={`${product.brand} ${product.name}`}
          />

          <div className="lg:max-w-md">
            <p className="text-sm font-semibold">{product.brand}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {product.name}
            </h1>
            <div className="mt-3">
              <PriceTag
                price={product.price}
                compareAtPrice={product.compareAtPrice}
                size="lg"
              />
            </div>
            <div className="mt-2">
              <Rating
                rating={product.rating}
                reviewCount={product.reviewCount}
              />
            </div>

            <div className="mt-8">
              <PurchasePanel product={product} />
            </div>

            <div className="mt-10">
              <Accordion title="Description" defaultOpen>
                {product.description}
              </Accordion>
              <Accordion title="Details">
                <ul className="list-disc space-y-1 pl-4">
                  {product.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              </Accordion>
              <Accordion title="Delivery and returns">
                Free standard delivery on orders over ₹1,499, otherwise ₹99.
                Delivered in 3 to 5 working days. Returns accepted within 14
                days of delivery, unworn and with tags.
              </Accordion>
            </div>
          </div>
        </div>
      </Container>

      <Container className="py-10">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">
          You might also like
        </h2>
        <ProductGrid products={related} />
      </Container>
    </main>
  );
}
