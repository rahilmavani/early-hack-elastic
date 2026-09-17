import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { WishlistGrid } from "@/components/product/WishlistGrid";

export const metadata: Metadata = { title: "Wishlist" };

export default function WishlistPage() {
  return (
    <main>
      <Container className="py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Wishlist</h1>
        <WishlistGrid />
      </Container>
    </main>
  );
}
