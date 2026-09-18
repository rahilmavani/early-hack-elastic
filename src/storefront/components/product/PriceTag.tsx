import { discountPercent, formatPrice } from "@/lib/money";
import { cn } from "@/lib/cn";

type PriceTagProps = {
  price: number;
  compareAtPrice?: number;
  size?: "sm" | "lg";
};

export function PriceTag({
  price,
  compareAtPrice,
  size = "sm",
}: PriceTagProps) {
  const hasDiscount = compareAtPrice !== undefined && compareAtPrice > price;

  return (
    <p
      className={cn(
        "flex items-baseline gap-2",
        size === "lg" ? "text-lg" : "text-sm",
      )}
    >
      <span className="font-medium">{formatPrice(price)}</span>
      {hasDiscount && (
        <>
          <span className="text-ink-faint line-through">
            {formatPrice(compareAtPrice)}
          </span>
          <span className="text-accent">
            {discountPercent(price, compareAtPrice)}% off
          </span>
        </>
      )}
    </p>
  );
}
