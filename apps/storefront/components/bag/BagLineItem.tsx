import Image from "next/image";
import Link from "next/link";
import type { BagLine } from "@/lib/bag";
import { formatPrice } from "@/lib/money";
import { QuantityStepper } from "@/components/bag/QuantityStepper";

type BagLineItemProps = {
  line: BagLine;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
};

export function BagLineItem({
  line,
  onQuantityChange,
  onRemove,
}: BagLineItemProps) {
  const { product } = line;

  return (
    <div className="border-line flex gap-4 border-b py-6">
      <Link
        href={`/p/${product.slug}`}
        className="bg-canvas-muted relative aspect-[3/4] w-24 shrink-0"
      >
        <Image
          src={product.images[0]}
          alt={product.name}
          fill
          sizes="96px"
          className="object-cover"
        />
      </Link>

      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">{product.brand}</p>
            <p className="text-ink-muted text-sm">{product.name}</p>
            <p className="text-ink-muted mt-1 text-xs">Size {line.size}</p>
          </div>
          <p className="text-sm font-medium">
            {formatPrice(product.price * line.quantity)}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between pt-4">
          <QuantityStepper value={line.quantity} onChange={onQuantityChange} />
          <button
            type="button"
            onClick={onRemove}
            className="text-ink-muted hover:text-ink text-xs"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
