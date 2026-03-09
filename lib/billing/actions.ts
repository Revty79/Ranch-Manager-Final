"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import { billingCouponRedemptions, billingCoupons, ranches } from "@/lib/db/schema";
import { hashCouponCode, normalizeCouponCode } from "./coupons";
import { getStripeClient, isStripeConfigured } from "./stripe";

export interface BillingActionState {
  error?: string;
  success?: string;
}

const applyCouponSchema = z.object({
  code: z.string().trim().min(1, "Enter a coupon code."),
});

export async function createCheckoutSessionAction(
  _prevState: BillingActionState,
  _formData: FormData,
): Promise<BillingActionState> {
  void _prevState;
  void _formData;

  const context = await requireRole(["owner"], { requirePaid: false });
  if (!isStripeConfigured()) {
    return {
      error:
        "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID in environment.",
    };
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return { error: "Missing STRIPE_PRICE_ID." };
  }

  const stripe = getStripeClient();

  let customerId = context.ranch.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: context.user.email,
      name: context.ranch.name,
      metadata: {
        ranchId: context.ranch.id,
      },
    });
    customerId = customer.id;

    await db
      .update(ranches)
      .set({
        stripeCustomerId: customerId,
        subscriptionUpdatedAt: new Date(),
      })
      .where(eq(ranches.id, context.ranch.id));
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/app/settings?billing=success`,
    cancel_url: `${appUrl}/app/settings?billing=cancel`,
    metadata: {
      ranchId: context.ranch.id,
    },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return { error: "Unable to create checkout session." };
  }

  redirect(session.url);
}

export async function applyCouponCodeAction(
  _prevState: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const context = await requireRole(["owner"], { requirePaid: false });
  const parsed = applyCouponSchema.safeParse({
    code: formData.get("code"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid coupon code." };
  }

  const normalizedCode = normalizeCouponCode(parsed.data.code);
  let codeHash: string;
  try {
    codeHash = hashCouponCode(normalizedCode);
  } catch {
    return {
      error:
        "Coupon hashing is not configured. Set BILLING_COUPON_PEPPER or APP_SECRET, then restart the server.",
    };
  }
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const [coupon] = await tx
      .select({
        id: billingCoupons.id,
        grantType: billingCoupons.grantType,
        expiresAt: billingCoupons.expiresAt,
        maxRedemptions: billingCoupons.maxRedemptions,
      })
      .from(billingCoupons)
      .where(and(eq(billingCoupons.codeHash, codeHash), eq(billingCoupons.isActive, true)))
      .limit(1);

    if (!coupon) {
      return { error: "Coupon code is invalid or inactive." } satisfies BillingActionState;
    }

    if (coupon.expiresAt && coupon.expiresAt <= now) {
      return { error: "This coupon has expired." } satisfies BillingActionState;
    }

    const [existingRedemption] = await tx
      .select({ id: billingCouponRedemptions.id })
      .from(billingCouponRedemptions)
      .where(
        and(
          eq(billingCouponRedemptions.couponId, coupon.id),
          eq(billingCouponRedemptions.ranchId, context.ranch.id),
        ),
      )
      .limit(1);

    if (existingRedemption) {
      return { success: "Coupon already applied for this ranch." } satisfies BillingActionState;
    }

    const [{ redemptionCount }] = await tx
      .select({ redemptionCount: sql<number>`count(*)::int` })
      .from(billingCouponRedemptions)
      .where(eq(billingCouponRedemptions.couponId, coupon.id));

    if (
      coupon.maxRedemptions !== null &&
      coupon.maxRedemptions !== undefined &&
      redemptionCount >= coupon.maxRedemptions
    ) {
      return { error: "This coupon has reached its redemption limit." } satisfies BillingActionState;
    }

    await tx.insert(billingCouponRedemptions).values({
      couponId: coupon.id,
      ranchId: context.ranch.id,
      redeemedByUserId: context.user.id,
      redeemedAt: now,
    });

    if (coupon.grantType === "beta_lifetime_access") {
      await tx
        .update(ranches)
        .set({
          betaLifetimeAccess: true,
          subscriptionUpdatedAt: now,
        })
        .where(eq(ranches.id, context.ranch.id));

      return { success: "Coupon applied. Lifetime beta access is enabled." } satisfies BillingActionState;
    }

    return { error: "Coupon grant type is not supported." } satisfies BillingActionState;
  });

  if (result.error) {
    return result;
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/billing-required");
  revalidatePath("/billing-required");
  return result;
}

export const claimBetaLifetimeAccessAction = applyCouponCodeAction;
