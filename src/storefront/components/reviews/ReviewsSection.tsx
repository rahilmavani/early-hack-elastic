"use client";

import { useEffect, useState } from "react";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { ReviewList } from "@/components/reviews/ReviewList";
import { Button } from "@/components/ui/Button";
import type { Review } from "@/lib/reviews";
import { apiFetch } from "@/lib/telemetry/apiFetch";

type ReviewsSectionProps = {
  productId: string;
};

export function ReviewsSection({ productId }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiFetch(`/api/reviews?productId=${encodeURIComponent(productId)}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: Review[]) => {
        if (!cancelled) {
          setReviews(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReviews([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  function handleSubmitted(review: Review) {
    setReviews((current) => [review, ...(current ?? [])]);
    setWriting(false);
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Reviews</h2>
        {!writing && (
          <Button variant="secondary" onClick={() => setWriting(true)}>
            Write a review
          </Button>
        )}
      </div>

      {writing && (
        <div className="mt-6">
          <ReviewForm
            productId={productId}
            onSubmitted={handleSubmitted}
            onCancel={() => setWriting(false)}
          />
        </div>
      )}

      <div className="mt-4">
        {reviews === null ? (
          <p className="text-ink-muted py-8 text-sm">Loading reviews…</p>
        ) : (
          <ReviewList reviews={reviews} />
        )}
      </div>
    </section>
  );
}
