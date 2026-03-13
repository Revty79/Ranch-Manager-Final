"use server";

import Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import { billingCouponRedemptions, billingCoupons, ranches } from "@/lib/db/schema";
import { hashCouponCode, normalizeCouponCode } from "./coupons";
import { isTrialEligible, resolveTrialConfig } from "./trial";
import { getStripeClient, isStripeConfigured } from "./stripe";

export interface BillingActionState {
  error?: string;
  success?: string;
}

const applyCouponSchema = z.object({
  code: z.string().trim().min(1, "Enter a coupon code."),
});

const allowedCheckoutReturnPaths = ["/app/settings", "/app/billing-required"] as const;

function toStripeMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const record = error as { message?: string };
    if (record.message) {
      return record.message;
    }
  }
  return "Stripe request failed.";
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const first = value.split(",")[0]?.trim();
  return first || null;
}

function isLocalHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function parseOriginFromConfiguredUrl(value: string | undefined): URL | null {
  if (!value) {
    return null;
  }

  const candidate = value.trim();
  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return new URL(url.origin);
  } catch {
    return null;
  }
}

function parseOriginFromRequestHeaders(hostValue: string | null, protoValue: string | null): URL | null {
  const host = firstHeaderValue(hostValue);
  if (!host) {
    return null;
  }

  const proto = firstHeaderValue(protoValue);
  const protocol =
    proto === "http" || proto === "https"
      ? proto
      : host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]")
        ? "http"
        : "https";

  try {
    return new URL(`${protocol}://${host}`);
  } catch {
    return null;
  }
}

async function resolveAppBaseUrl(): Promise<string> {
  const requestHeaders = await headers();
  const requestOrigin = parseOriginFromRequestHeaders(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    requestHeaders.get("x-forwarded-proto"),
  );
  const configuredOrigin = parseOriginFromConfiguredUrl(process.env.APP_URL);

  if (configuredOrigin && requestOrigin) {
    // Prefer request origin if APP_URL is still localhost on a deployed environment.
    if (isLocalHost(configuredOrigin.hostname) && !isLocalHost(requestOrigin.hostname)) {
      return requestOrigin.origin;
    }
    return configuredOrigin.origin;
  }

  if (requestOrigin) {
    return requestOrigin.origin;
  }

  if (configuredOrigin) {
    return configuredOrigin.origin;
  }

  return "http://localhost:3000";
}

async function resolveSubscriptionPriceId(
  stripe: Stripe,
  configuredId: string,
): Promise<{ priceId?: string; error?: string }> {
  const trimmed = configuredId.trim();
  if (!trimmed) {
    return { error: "Missing STRIPE_PRICE_ID." };
  }

  try {
    if (trimmed.startsWith("price_")) {
      const price = await stripe.prices.retrieve(trimmed);
      if (!price.recurring) {
        return {
          error: "Configured STRIPE_PRICE_ID points to a one-time price. Use a recurring price for subscriptions.",
        };
      }
      return { priceId: price.id };
    }

    if (trimmed.startsWith("prod_")) {
      const product = await stripe.products.retrieve(trimmed, {
        expand: ["default_price"],
      });

      let candidatePrice: Stripe.Price | null = null;
      if (typeof product.default_price === "string") {
        candidatePrice = await stripe.prices.retrieve(product.default_price);
      } else if (product.default_price) {
        candidatePrice = product.default_price;
      }

      if (!candidatePrice || !candidatePrice.recurring) {
        const recurringPrices = await stripe.prices.list({
          product: product.id,
          active: true,
          limit: 100,
        });
        candidatePrice =
          recurringPrices.data.find((price) => Boolean(price.recurring)) ?? null;
      }

      if (!candidatePrice || !candidatePrice.recurring) {
        return {
          error:
            "Configured STRIPE_PRICE_ID is a product without an active recurring price. Add a recurring price in Stripe and set it as default (or use a price_ ID).",
        };
      }

      return { priceId: candidatePrice.id };
    }
  } catch (error) {
    return {
      error: `Unable to resolve STRIPE_PRICE_ID in Stripe: ${toStripeMessage(error)}`,
    };
  }

  return {
    error:
      "STRIPE_PRICE_ID must start with price_ (recommended) or prod_.",
  };
}

function resolveCheckoutReturnPath(formData: FormData): (typeof allowedCheckoutReturnPaths)[number] {
  const returnPath = formData.get("returnPath");
  if (
    typeof returnPath === "string" &&
    allowedCheckoutReturnPaths.includes(
      returnPath as (typeof allowedCheckoutReturnPaths)[number],
    )
  ) {
    return returnPath as (typeof allowedCheckoutReturnPaths)[number];
  }

  return "/app/settings";
}

export async function createCheckoutSessionAction(
  _prevState: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  void _prevState;

  const context = await requireRole(["owner"], { requirePaid: false });
  if (
    context.ranch.subscriptionStatus === "active" ||
    context.ranch.subscriptionStatus === "trialing"
  ) {
    return {
      error:
        "Subscription access is already active. Use Stripe customer portal in settings to manage or cancel.",
    };
  }

  if (!isStripeConfigured()) {
    return {
      error:
        "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID in environment.",
    };
  }

  const configuredPriceId = process.env.STRIPE_PRICE_ID;
  if (!configuredPriceId) {
    return { error: "Missing STRIPE_PRICE_ID." };
  }
  const returnPath = resolveCheckoutReturnPath(formData);

  const trialConfig = resolveTrialConfig();
  if (trialConfig.error) {
    return { error: trialConfig.error };
  }

  const trialEligible =
    trialConfig.trialDays !== null && isTrialEligible(context.ranch);

  const stripe = getStripeClient();
  const resolvedPrice = await resolveSubscriptionPriceId(stripe, configuredPriceId);
  if (!resolvedPrice.priceId) {
    return { error: resolvedPrice.error ?? "Invalid Stripe price configuration." };
  }

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

  const baseUrl = await resolveAppBaseUrl();
  const successStatus = trialEligible ? "trial_started" : "success";
  const successUrl = `${baseUrl}${returnPath}?billing=${successStatus}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}${returnPath}?billing=cancel`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: resolvedPrice.priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      ranchId: context.ranch.id,
      trialDays: trialEligible ? String(trialConfig.trialDays) : "",
    },
    allow_promotion_codes: true,
    subscription_data: {
      metadata: {
        ranchId: context.ranch.id,
      },
      trial_period_days: trialEligible ? (trialConfig.trialDays ?? undefined) : undefined,
    },
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

export async function createCustomerPortalSessionAction(
  _prevState: BillingActionState,
  _formData: FormData,
): Promise<BillingActionState> {
  void _prevState;
  void _formData;

  const context = await requireRole(["owner"], { requirePaid: false });
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return {
      error: "Stripe is not configured. Set STRIPE_SECRET_KEY in environment.",
    };
  }

  if (!context.ranch.stripeCustomerId) {
    return {
      error:
        "No Stripe customer exists for this ranch yet. Start checkout once before opening subscription management.",
    };
  }

  const baseUrl = await resolveAppBaseUrl();
  const stripe = getStripeClient();

  let portalSession: Stripe.BillingPortal.Session;
  try {
    portalSession = await stripe.billingPortal.sessions.create({
      customer: context.ranch.stripeCustomerId,
      return_url: `${baseUrl}/app/settings?billing=portal_return`,
    });
  } catch (error) {
    return {
      error: `Unable to open Stripe customer portal: ${toStripeMessage(error)}`,
    };
  }

  if (!portalSession.url) {
    return { error: "Stripe customer portal is unavailable for this account." };
  }

  redirect(portalSession.url);
}

export const claimBetaLifetimeAccessAction = applyCouponCodeAction;
