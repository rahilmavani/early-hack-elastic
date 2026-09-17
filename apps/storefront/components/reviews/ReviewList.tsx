import Image from "next/image";
import type { Review } from "@/lib/reviews";
import { StarRating } from "@/components/reviews/StarRating";

type ReviewListProps = {
  reviews: Review[];
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function ReviewList({ reviews }: ReviewListProps) {
  if (reviews.length === 0) {
    return <p className="text-ink-muted py-8 text-sm">No reviews yet.</p>;
  }

  return (
    <ul className="divide-line divide-y">
      {reviews.map((review) => (
        <li key={review.id} className="py-6">
          <div className="flex items-center justify-between gap-4">
            <StarRating value={review.rating} size={14} />
            <span className="text-ink-faint text-xs">
              {dateFormatter.format(new Date(review.createdAt))}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium">{review.title}</p>
          <p className="text-ink-muted mt-1 text-sm leading-relaxed">
            {review.body}
          </p>
          {review.photo && (
            <div className="bg-canvas-muted relative mt-3 aspect-square w-20 overflow-hidden">
              <Image
                src={review.photo}
                alt="Customer photo"
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          )}
          <p className="text-ink-muted mt-3 text-xs">{review.authorName}</p>
        </li>
      ))}
    </ul>
  );
}
