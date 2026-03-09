"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import { ranches } from "@/lib/db/schema";
import { getStripeClient, isStripeConfigured } from "./stripe";

export interface BillingActionState {
  error?: string;
  success?: string;
}

const claimBetaSchema = z.object({
  code: z.string().trim().min(1, "Enter a beta access code."),
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

export async function claimBetaLifetimeAccessAction(
  _prevState: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const context = await requireRole(["owner"], { requirePaid: false });
  const parsed = claimBetaSchema.safeParse({
    code: formData.get("code"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid code." };
  }

  const expectedCode = process.env.BETA_LIFETIME_CODE;
  if (!expectedCode) {
    return { error: "Beta code flow is not configured on this environment." };
  }

  if (parsed.data.code !== expectedCode) {
    return { error: "Code did not match. Please verify and try again." };
  }

  await db
    .update(ranches)
    .set({
      betaLifetimeAccess: true,
      subscriptionUpdatedAt: new Date(),
    })
    .where(eq(ranches.id, context.ranch.id));

  revalidatePath("/app/settings");
  return { success: "Beta lifetime access enabled." };
}
