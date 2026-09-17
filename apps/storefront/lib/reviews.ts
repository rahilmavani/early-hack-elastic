export type Review = {
  id: string;
  productId: string;
  rating: number;
  title: string;
  body: string;
  authorName: string;
  photo?: string;
  createdAt: string;
};

export type ReviewRequest = Omit<Review, "id" | "createdAt">;

export const maxPhotoBytes = 2 * 1024 * 1024;

export function createReviewId() {
  return `r-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function validateReview(values: ReviewRequest) {
  const errors: Partial<Record<keyof ReviewRequest, string>> = {};

  if (
    !Number.isInteger(values.rating) ||
    values.rating < 1 ||
    values.rating > 5
  ) {
    errors.rating = "Pick a star rating";
  }
  if (values.title.trim().length < 3) {
    errors.title = "Add a short title";
  }
  if (values.body.trim().length < 10) {
    errors.body = "Tell us a little more";
  }
  if (values.authorName.trim().length < 2) {
    errors.authorName = "Add your name";
  }

  return errors;
}
