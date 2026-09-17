"use client";

import Link from "next/link";
import { BagLineItem } from "@/components/bag/BagLineItem";
import { OrderSummary } from "@/components/bag/OrderSummary";
import { Button } from "@/components/ui/Button";
import { bagItemKey, bagTotals, resolveBagLines } from "@/lib/bag";
import { useBag } from "@/lib/store/BagProvider";

export function BagView() {
  const bag = useBag();
  const lines = resolveBagLines(bag.items);
  const totals = bagTotals(lines);

  if (!bag.hydrated) {
    return null;
  }

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-ink-muted text-sm">Your bag is empty.</p>
        <Link href="/" className="mt-4 inline-block">
          <Button variant="secondary">Continue shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <div>
        {lines.map((line) => (
          <BagLineItem
            key={bagItemKey(line)}
            line={line}
            onQuantityChange={(quantity) =>
              bag.setQuantity(line.productId, line.size, quantity)
            }
            onRemove={() => bag.removeItem(line.productId, line.size)}
          />
        ))}
      </div>

      <OrderSummary
        subtotal={totals.subtotal}
        delivery={totals.delivery}
        total={totals.total}
      >
        <Link href="/checkout" className="block">
          <Button size="lg" fullWidth>
            Proceed to checkout
          </Button>
        </Link>
      </OrderSummary>
    </div>
  );
}
