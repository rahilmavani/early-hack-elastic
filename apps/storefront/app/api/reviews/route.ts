import { NextResponse } from "next/server";
import { seedReviewsFor } from "@/data/review-seeds";
import { getProducts } from "@/lib/catalogue";
import {
  createReviewId,
  maxPhotoBytes,
  validateReview,
  type Review,
  type ReviewRequest,
} from "@/lib/reviews";

const submittedReviews = new Map<string, Review[]>();

function isReviewRequest(body: unknown): body is ReviewRequest {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const candidate = body as Partial<ReviewRequest>;
  return (
    typeof candidate.productId === "string" &&
    typeof candidate.rating === "number" &&
    typeof candidate.title === "string" &&
    typeof candidate.body === "string" &&
    typeof candidate.authorName === "string" &&
    (candidate.photo === undefined || typeof candidate.photo === "string")
  );
}

export async function GET(request: Request) {
  const productId = new URL(request.url).searchParams.get("productId");
  if (!productId) {
    return NextResponse.json(
      { error: "productId is required" },
      { status: 400 },
    );
  }

  const reviews = [
    ...(submittedReviews.get(productId) ?? []),
    ...seedReviewsFor(productId),
  ];
  return NextResponse.json(reviews);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isReviewRequest(body)) {
    return NextResponse.json({ error: "Invalid review" }, { status: 400 });
  }

  const productExists = getProducts().some(
    (product) => product.id === body.productId,
  );
  if (!productExists) {
    return NextResponse.json({ error: "Unknown product" }, { status: 400 });
  }

  const errors = validateReview(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: "Invalid review", fields: errors },
      { status: 400 },
    );
  }

  if (body.photo && body.photo.length > maxPhotoBytes * 1.4) {
    return NextResponse.json({ error: "Photo is too large" }, { status: 413 });
  }

  const review: Review = {
    ...body,
    id: createReviewId(),
    createdAt: new Date().toISOString(),
  };

  const existing = submittedReviews.get(body.productId) ?? [];
  submittedReviews.set(body.productId, [review, ...existing]);

  return NextResponse.json(review, { status: 201 });
}
