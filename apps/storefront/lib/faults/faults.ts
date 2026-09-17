export const faultNames = [
  "silent-checkout",
  "offscreen-validation",
  "dropped-upload",
  "stale-bag-total",
] as const;

export type FaultName = (typeof faultNames)[number];

export function isFaultName(value: string): value is FaultName {
  return (faultNames as readonly string[]).includes(value);
}
