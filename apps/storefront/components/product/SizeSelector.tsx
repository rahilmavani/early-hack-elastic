import { cn } from "@/lib/cn";

type SizeSelectorProps = {
  sizes: string[];
  value: string | null;
  onChange: (size: string) => void;
};

export function SizeSelector({ sizes, value, onChange }: SizeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {sizes.map((size) => (
        <button
          key={size}
          type="button"
          onClick={() => onChange(size)}
          aria-pressed={value === size}
          className={cn(
            "h-10 min-w-12 border px-3 text-sm transition-colors",
            value === size
              ? "border-ink bg-ink text-white"
              : "border-line hover:border-ink",
          )}
        >
          {size}
        </button>
      ))}
    </div>
  );
}
