// The order of pages under a parent (spec §4.3). An order is one or more of the 62 characters
// 0–9, A–Z and a–z, in that order, and never ends in 0. Comparing code unit by code unit sorts
// them in that order, and between any two there is always another.

export const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const ORDER = /^[0-9A-Za-z]*[1-9A-Za-z]$/;

/** The smallest valid order of exactly `length` characters that sorts after `low`, or undefined. */
function smallestAfter(low: string | undefined, length: number): string | undefined {
  if (low === undefined) return "0".repeat(length - 1) + "1";
  if (low.length < length) return low + "0".repeat(length - low.length - 1) + "1";
  const digits = [...low.slice(0, length)].map((c) => DIGITS.indexOf(c));
  let at = length - 1;
  while (at >= 0 && digits[at] === 61) digits[at--] = 0;
  if (at < 0) return undefined;
  digits[at]!++;
  if (digits[length - 1] === 0) digits[length - 1] = 1;
  return digits.map((d) => DIGITS[d]).join("");
}

/** The shortest order that sorts between `low` and `high`, either of which may be absent, taking the lower of equally short ones. */
export function between(low: string | undefined, high: string | undefined): string {
  if (low !== undefined && high !== undefined && !(low < high)) {
    // Neighbours with equal orders, told apart by identifier: any order after the lower one will do.
    high = undefined;
  }
  for (let length = 1; ; length++) {
    const candidate = smallestAfter(low, length);
    if (candidate !== undefined && (high === undefined || candidate < high)) return candidate;
  }
}
