"use client";

import { useState } from "react";
import type { Product } from "@/data/products";
import { SizeSelector } from "@/components/product/SizeSelector";

type PurchasePanelProps = {
  product: Product;
};

export function PurchasePanel({ product }: PurchasePanelProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(
    product.sizes.length === 1 ? product.sizes[0] : null,
  );

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
    </div>
  );
}
