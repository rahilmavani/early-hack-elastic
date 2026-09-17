import { formatPrice } from "@/lib/money";

type OrderSummaryProps = {
  subtotal: number;
  delivery: number;
  total: number;
  children?: React.ReactNode;
};

export function OrderSummary({
  subtotal,
  delivery,
  total,
  children,
}: OrderSummaryProps) {
  return (
    <div className="border-line border p-6">
      <p className="text-sm font-medium">Order summary</p>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-muted">Subtotal</dt>
          <dd>{formatPrice(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-muted">Delivery</dt>
          <dd>{delivery === 0 ? "Free" : formatPrice(delivery)}</dd>
        </div>
        <div className="border-line flex justify-between border-t pt-3 font-medium">
          <dt>Total</dt>
          <dd>{formatPrice(total)}</dd>
        </div>
      </dl>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
