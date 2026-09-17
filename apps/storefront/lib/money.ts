const formatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatPrice(amount: number) {
  return formatter.format(amount);
}

export function discountPercent(price: number, compareAtPrice: number) {
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}
