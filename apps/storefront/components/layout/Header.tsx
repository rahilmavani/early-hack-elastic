import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";
import { categories } from "@/data/categories";
import { Container } from "@/components/layout/Container";
import { MobileNav } from "@/components/layout/MobileNav";

export function Header() {
  return (
    <header className="border-line bg-canvas sticky top-0 z-40 border-b">
      <Container className="flex h-16 items-center gap-6">
        <MobileNav />

        <Link href="/" className="text-lg font-semibold tracking-tight">
          Northline
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/c/${category.slug}`}
              className="text-ink-muted hover:text-ink text-sm font-medium transition-colors"
            >
              {category.name}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <Link href="/wishlist" aria-label="Wishlist" className="p-1">
            <Heart size={20} strokeWidth={1.5} />
          </Link>
          <Link href="/bag" aria-label="Bag" className="p-1">
            <ShoppingBag size={20} strokeWidth={1.5} />
          </Link>
        </div>
      </Container>
    </header>
  );
}
