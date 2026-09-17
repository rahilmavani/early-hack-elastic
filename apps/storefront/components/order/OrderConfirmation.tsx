"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { getProducts } from "@/lib/catalogue";
import { deliveryOptions } from "@/lib/checkout";
import { formatPrice } from "@/lib/money";
import { useOrders } from "@/lib/store/OrdersProvider";

type OrderConfirmationProps = {
  orderId: string;
};

export function OrderConfirmation({ orderId }: OrderConfirmationProps) {
  const orders = useOrders();

  if (!orders.hydrated) {
    return null;
  }

  const order = orders.getOrder(orderId);
  if (!order) {
    return (
      <div className="py-16 text-center">
        <p className="text-ink-muted text-sm">
          We couldn&apos;t find that order.
        </p>
        <Link href="/" className="mt-4 inline-block">
          <Button variant="secondary">Continue shopping</Button>
        </Link>
      </div>
    );
  }

  const products = getProducts();
  const deliveryLabel = deliveryOptions.find(
    (option) => option.value === order.delivery,
  )?.label;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-ink-muted text-xs font-medium tracking-[0.2em] uppercase">
        Order placed
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Thanks, {order.address.fullName}.
      </h1>
      <p className="text-ink-muted mt-2 text-sm">
        Order <span className="text-ink font-medium">{order.id}</span> is
        confirmed. A receipt has been sent to {order.email}.
      </p>

      <div className="divide-line border-line mt-8 divide-y border-y">
        {order.items.map((item) => {
          const product = products.find(
            (candidate) => candidate.id === item.productId,
          );
          if (!product) {
            return null;
          }
          return (
            <div
              key={`${item.productId}:${item.size}`}
              className="flex gap-4 py-4"
            >
              <div className="bg-canvas-muted relative aspect-[3/4] w-16 shrink-0">
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="flex-1 text-sm">
                <p className="font-semibold">{product.brand}</p>
                <p className="text-ink-muted">{product.name}</p>
                <p className="text-ink-muted text-xs">
                  Size {item.size} · Qty {item.quantity}
                </p>
              </div>
              <p className="text-sm font-medium">
                {formatPrice(item.unitPrice * item.quantity)}
              </p>
            </div>
          );
        })}
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-muted">Subtotal</dt>
          <dd>{formatPrice(order.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-muted">{deliveryLabel} delivery</dt>
          <dd>
            {order.deliveryFee === 0 ? "Free" : formatPrice(order.deliveryFee)}
          </dd>
        </div>
        <div className="border-line flex justify-between border-t pt-3 font-medium">
          <dt>Total</dt>
          <dd>{formatPrice(order.total)}</dd>
        </div>
      </dl>

      <div className="mt-8 grid gap-6 text-sm sm:grid-cols-2">
        <div>
          <p className="font-medium">Delivering to</p>
          <p className="text-ink-muted mt-1">
            {order.address.line1}
            {order.address.line2 && <>, {order.address.line2}</>}
            <br />
            {order.address.city}, {order.address.state} {order.address.pincode}
          </p>
        </div>
        <div>
          <p className="font-medium">Paid with</p>
          <p className="text-ink-muted mt-1">Card ending {order.cardLast4}</p>
        </div>
      </div>

      <Link href="/" className="mt-10 inline-block">
        <Button variant="secondary">Continue shopping</Button>
      </Link>
    </div>
  );
}
