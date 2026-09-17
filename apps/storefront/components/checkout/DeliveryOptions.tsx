import { deliveryOptions, type DeliveryMethod } from "@/lib/checkout";
import { deliveryFeeFor } from "@/lib/bag";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/cn";

type DeliveryOptionsProps = {
  value: DeliveryMethod;
  subtotal: number;
  onChange: (value: DeliveryMethod) => void;
};

export function DeliveryOptions({
  value,
  subtotal,
  onChange,
}: DeliveryOptionsProps) {
  return (
    <div className="space-y-3">
      {deliveryOptions.map((option) => {
        const fee = deliveryFeeFor(subtotal, option.value);
        const selected = value === option.value;

        return (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-center gap-3 border p-4 text-sm transition-colors",
              selected ? "border-ink" : "border-line hover:border-ink-faint",
            )}
          >
            <input
              type="radio"
              name="delivery"
              className="accent-ink size-4"
              checked={selected}
              onChange={() => onChange(option.value)}
            />
            <span className="flex-1">
              <span className="block font-medium">{option.label}</span>
              <span className="text-ink-muted block">{option.eta}</span>
            </span>
            <span className="font-medium">
              {fee === 0 ? "Free" : formatPrice(fee)}
            </span>
          </label>
        );
      })}
    </div>
  );
}
