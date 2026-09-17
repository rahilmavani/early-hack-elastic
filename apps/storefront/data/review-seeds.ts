import type { Review } from "@/lib/reviews";

type ReviewSeed = Pick<Review, "rating" | "title" | "body" | "authorName">;

const seeds: ReviewSeed[] = [
  {
    rating: 5,
    title: "Exactly as pictured",
    body: "Fit is true to size and the fabric feels far better than the price suggests. Second one I've bought.",
    authorName: "Priya S.",
  },
  {
    rating: 4,
    title: "Good, runs slightly large",
    body: "Quality is excellent. I'd size down if you're between sizes. Delivery was two days early.",
    authorName: "Rohan M.",
  },
  {
    rating: 5,
    title: "Worth the wait",
    body: "Took a while to arrive but it was worth it. Stitching is neat and the colour hasn't faded after several washes.",
    authorName: "Ananya K.",
  },
  {
    rating: 4,
    title: "Solid everyday piece",
    body: "Nothing flashy, which is the point. Holds up well and goes with everything I own.",
    authorName: "Dev P.",
  },
  {
    rating: 3,
    title: "Nice but pricey",
    body: "The material is lovely, but I expected a little more for the money. Would buy again on sale.",
    authorName: "Meera J.",
  },
  {
    rating: 5,
    title: "Compliments every time",
    body: "I've been asked where this is from more than once. Comfortable and looks sharper than the photos.",
    authorName: "Arjun T.",
  },
];

function hashToIndex(value: string, modulo: number) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000003;
  }
  return hash % modulo;
}

export function seedReviewsFor(productId: string): Review[] {
  const first = hashToIndex(productId, seeds.length);
  const second = (first + 2) % seeds.length;

  return [seeds[first], seeds[second]].map((seed, index) => ({
    ...seed,
    id: `seed-${productId}-${index}`,
    productId,
    createdAt: new Date(
      Date.UTC(2026, 6 + index, 12 + index * 9),
    ).toISOString(),
  }));
}
