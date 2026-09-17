import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
};

export function StarRating({ value, onChange, size = 16 }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];

  if (!onChange) {
    return (
      <span
        className="inline-flex gap-0.5"
        aria-label={`${value} out of 5 stars`}
      >
        {stars.map((star) => (
          <Star
            key={star}
            size={size}
            strokeWidth={1.5}
            className={cn(star <= value ? "fill-ink" : "text-ink-faint")}
          />
        ))}
      </span>
    );
  }

  return (
    <div className="inline-flex gap-1" role="radiogroup" aria-label="Rating">
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={star === value}
          aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
          onClick={() => onChange(star)}
          className="p-0.5"
        >
          <Star
            size={size}
            strokeWidth={1.5}
            className={cn(
              star <= value ? "fill-ink" : "text-ink-faint hover:text-ink",
            )}
          />
        </button>
      ))}
    </div>
  );
}
