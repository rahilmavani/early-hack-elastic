"use client";

import { useState } from "react";
import { PhotoUpload } from "@/components/reviews/PhotoUpload";
import { StarRating } from "@/components/reviews/StarRating";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useFault } from "@/lib/faults/FaultProvider";
import { validateReview, type Review, type ReviewRequest } from "@/lib/reviews";

type ReviewFormProps = {
  productId: string;
  onSubmitted: (review: Review) => void;
  onCancel: () => void;
};

type FieldErrors = Partial<Record<keyof ReviewRequest, string>>;

export function ReviewForm({
  productId,
  onSubmitted,
  onCancel,
}: ReviewFormProps) {
  const fault = useFault();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Fault: the photo shows as uploaded but is never sent with the review.
    const attachedPhoto =
      fault === "dropped-upload" ? undefined : (photo ?? undefined);

    const request: ReviewRequest = {
      productId,
      rating,
      title,
      body,
      authorName,
      photo: attachedPhoto,
    };

    const validationErrors = validateReview(request);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        throw new Error(`Review failed with status ${response.status}`);
      }
      onSubmitted((await response.json()) as Review);
    } catch {
      setSubmitError("We couldn't post your review. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="border-line space-y-5 border p-6"
    >
      <div>
        <p className="text-ink-muted mb-1.5 text-xs font-medium">Your rating</p>
        <StarRating value={rating} onChange={setRating} size={22} />
        {errors.rating && (
          <p className="text-danger mt-1 text-xs">{errors.rating}</p>
        )}
      </div>

      <Input
        label="Title"
        value={title}
        error={errors.title}
        onChange={(event) => setTitle(event.target.value)}
      />

      <div>
        <label
          htmlFor="review-body"
          className="text-ink-muted mb-1.5 block text-xs font-medium"
        >
          Review
        </label>
        <textarea
          id="review-body"
          rows={4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="border-line focus:border-ink w-full border p-3 text-sm outline-none"
        />
        {errors.body && (
          <p className="text-danger mt-1 text-xs">{errors.body}</p>
        )}
      </div>

      <Input
        label="Your name"
        value={authorName}
        error={errors.authorName}
        onChange={(event) => setAuthorName(event.target.value)}
      />

      <PhotoUpload photo={photo} onChange={setPhoto} onError={setSubmitError} />

      {submitError && (
        <p role="alert" className="text-danger text-sm">
          {submitError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Posting..." : "Post review"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
