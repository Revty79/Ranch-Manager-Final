import { createHash } from "crypto";

export function normalizeCouponCode(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function getCouponHashSecret(): string {
  const secret = process.env.BILLING_COUPON_PEPPER ?? process.env.APP_SECRET;
  if (!secret) {
    throw new Error(
      "Missing coupon hash secret. Set BILLING_COUPON_PEPPER (recommended) or APP_SECRET.",
    );
  }

  return secret;
}

export function hashCouponCode(normalizedCode: string): string {
  return createHash("sha256")
    .update(`${getCouponHashSecret()}:${normalizedCode}`)
    .digest("hex");
}
