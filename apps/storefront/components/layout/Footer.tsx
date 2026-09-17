import Link from "next/link";
import { categories } from "@/data/categories";
import { Container } from "@/components/layout/Container";

const helpLinks = ["Delivery", "Returns", "Size guide", "Contact"];

export function Footer() {
  return (
    <footer className="border-line mt-24 border-t">
      <Container className="grid gap-10 py-12 text-sm sm:grid-cols-3">
        <div>
          <p className="text-lg font-semibold tracking-tight">Northline</p>
          <p className="text-ink-muted mt-2 max-w-xs">
            Considered clothing and footwear. Made to be worn, not replaced.
          </p>
        </div>

        <div>
          <p className="font-medium">Shop</p>
          <ul className="text-ink-muted mt-3 space-y-2">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link href={`/c/${category.slug}`} className="hover:text-ink">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-medium">Help</p>
          <ul className="text-ink-muted mt-3 space-y-2">
            {helpLinks.map((label) => (
              <li key={label}>
                <span className="cursor-default">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <div className="border-line border-t">
        <Container className="text-ink-faint py-4 text-xs">
          © {new Date().getFullYear()} Northline. A demo storefront.
        </Container>
      </div>
    </footer>
  );
}
