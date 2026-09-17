import { Star } from "lucide-react";

type RatingProps = {
  rating: number;
  reviewCount: number;
};

export function Rating({ rating, reviewCount }: RatingProps) {
  return (
    <p className="flex items-center gap-1.5 text-sm">
      <Star size={14} className="fill-ink" />
      <span className="font-medium">{rating.toFixed(1)}</span>
      <span className="text-ink-muted">({reviewCount} reviews)</span>
    </p>
  );
}
