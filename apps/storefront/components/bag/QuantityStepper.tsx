import { Minus, Plus } from "lucide-react";

type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
};

export function QuantityStepper({ value, onChange }: QuantityStepperProps) {
  return (
    <div className="border-line inline-flex h-9 items-center border">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(value - 1)}
        className="hover:bg-canvas-muted flex h-full w-9 items-center justify-center"
      >
        <Minus size={14} strokeWidth={1.5} />
      </button>
      <span className="w-8 text-center text-sm">{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(value + 1)}
        className="hover:bg-canvas-muted flex h-full w-9 items-center justify-center"
      >
        <Plus size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}
