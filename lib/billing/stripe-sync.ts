import Stripe from "stripe";
import { eq, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { ranches, type SubscriptionStatus } from "@/lib/db/schema";
import { getStripeClient } from "./stripe";

function resolveCustomerId(
  value: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return value.id;
}

function resolveSubscriptionId(
  value: string | Stripe.Subscription | null,
): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return value.id;
}

export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status,
): SubscriptionStatus {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (
    status === "past_due" ||
    status === "unpaid" ||
    status === "incomplete" ||
    status === "incomplete_expired"
  ) {
    return "past_due";
  }
  if (status === "canceled" || status === "paused") {
    return "canceled";
  }
  return "inactive";
}

export async function syncRanchFromSubscription(
  subscription: Stripe.Subscription,
  options: { ranchIdHint?: string | null } = {},
) {
  const customerId = resolveCustomerId(subscription.customer);
  const ranchIdHint = options.ranchIdHint ?? null;
  const status = mapStripeSubscriptionStatus(subscription.status);
  const currentPeriodEndEpoch = subscription.items.data[0]?.current_period_end ?? null;
  const currentPeriodEnd = currentPeriodEndEpoch
    ? new Date(currentPeriodEndEpoch * 1000)
    : null;
  const planKey = subscription.items.data[0]?.price?.id ?? null;

  const updateValues: {
    stripeSubscriptionId: string;
    subscriptionStatus: SubscriptionStatus;
    subscriptionPlanKey: string | null;
    subscriptionCurrentPeriodEnd: Date | null;
    subscriptionUpdatedAt: Date;
    stripeCustomerId?: string;
  } = {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: status,
    subscriptionPlanKey: planKey,
    subscriptionCurrentPeriodEnd: currentPeriodEnd,
    subscriptionUpdatedAt: new Date(),
  };

  if (customerId) {
    updateValues.stripeCustomerId = customerId;
  }

  if (ranchIdHint) {
    await db.update(ranches).set(updateValues).where(eq(ranches.id, ranchIdHint));
    return;
  }

  if (customerId) {
    await db
      .update(ranches)
      .set(updateValues)
      .where(
        or(
          eq(ranches.stripeCustomerId, customerId),
          eq(ranches.stripeSubscriptionId, subscription.id),
        ),
      );
    return;
  }

  await db
    .update(ranches)
    .set(updateValues)
    .where(eq(ranches.stripeSubscriptionId, subscription.id));
}

interface SyncCheckoutSessionInput {
  ranchId: string;
  checkoutSessionId: string;
}

interface SyncCheckoutSessionResult {
  ok: boolean;
  accessGranted: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  error?: string;
}

export async function syncRanchFromCheckoutSession(
  input: SyncCheckoutSessionInput,
): Promise<SyncCheckoutSessionResult> {
  const sessionId = input.checkoutSessionId.trim();
  if (!sessionId.startsWith("cs_")) {
    return {
      ok: false,
      accessGranted: false,
      subscriptionStatus: null,
      error: "Invalid Stripe checkout session ID.",
    };
  }

  let stripe: Stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return {
      ok: false,
      accessGranted: false,
      subscriptionStatus: null,
      error: "Stripe is not configured on the server.",
    };
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return {
      ok: false,
      accessGranted: false,
      subscriptionStatus: null,
      error: "Unable to retrieve Stripe checkout session.",
    };
  }

  const sessionRanchId = session.metadata?.ranchId ?? null;
  if (sessionRanchId && sessionRanchId !== input.ranchId) {
    return {
      ok: false,
      accessGranted: false,
      subscriptionStatus: null,
      error: "Stripe checkout session does not match this ranch.",
    };
  }

  const subscriptionId = resolveSubscriptionId(session.subscription);
  if (!subscriptionId) {
    return {
      ok: false,
      accessGranted: false,
      subscriptionStatus: null,
      error: "Stripe checkout session has no subscription.",
    };
  }

  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } catch {
    return {
      ok: false,
      accessGranted: false,
      subscriptionStatus: null,
      error: "Unable to retrieve Stripe subscription from checkout session.",
    };
  }

  await syncRanchFromSubscription(subscription, { ranchIdHint: input.ranchId });

  const [ranch] = await db
    .select({
      subscriptionStatus: ranches.subscriptionStatus,
      betaLifetimeAccess: ranches.betaLifetimeAccess,
    })
    .from(ranches)
    .where(eq(ranches.id, input.ranchId))
    .limit(1);

  if (!ranch) {
    return {
      ok: false,
      accessGranted: false,
      subscriptionStatus: null,
      error: "Ranch was not found after Stripe sync.",
    };
  }

  const accessGranted =
    ranch.betaLifetimeAccess ||
    ranch.subscriptionStatus === "active" ||
    ranch.subscriptionStatus === "trialing";

  return {
    ok: true,
    accessGranted,
    subscriptionStatus: ranch.subscriptionStatus,
  };
}
