"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Product } from "@/data/products";
import { SizeSelector } from "@/components/product/SizeSelector";
import { WishlistButton } from "@/components/product/WishlistButton";
import { Button } from "@/components/ui/Button";
import { useBag } from "@/lib/store/BagProvider";

type PurchasePanelProps = {
  product: Product;
};

export function PurchasePanel({ product }: PurchasePanelProps) {
  const bag = useBag();
  const [selectedSize, setSelectedSize] = useState<string | null>(
    product.sizes.length === 1 ? product.sizes[0] : null,
  );
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (!justAdded) {
      return;
    }
    const timer = window.setTimeout(() => setJustAdded(false), 2500);
    return () => window.clearTimeout(timer);
  }, [justAdded]);

  function handleAddToBag() {
    if (!selectedSize) {
      return;
    }
    bag.addItem(product.id, selectedSize);
    setJustAdded(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm">
          <span className="text-ink-muted">Colour:</span> {product.colour.name}
          <span
            aria-hidden
            className="border-line ml-2 inline-block size-3 rounded-full border align-middle"
            style={{ backgroundColor: product.colour.hex }}
          />
        </p>
        <p className="mb-3 text-sm">
          <span className="text-ink-muted">Size:</span>{" "}
          {selectedSize ?? "Select a size"}
        </p>
        <SizeSelector
          sizes={product.sizes}
          value={selectedSize}
          onChange={setSelectedSize}
        />
      </div>

      <div className="flex gap-3">
        <Button
          size="lg"
          className="flex-1"
          disabled={!selectedSize}
          onClick={handleAddToBag}
        >
          {justAdded ? "Added to bag" : "Add to bag"}
        </Button>
        <WishlistButton productId={product.id} variant="labelled" />
      </div>

      {justAdded && (
        <p className="text-ink-muted text-sm">
          Added.{" "}
          <Link href="/bag" className="text-ink underline underline-offset-4">
            View bag
          </Link>
        </p>
      )}
    </div>
  );
}
