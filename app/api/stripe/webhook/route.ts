import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { ranches, type SubscriptionStatus } from "@/lib/db/schema";
import { getStripeClient } from "@/lib/billing/stripe";

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due" || status === "unpaid") return "past_due";
  return "canceled";
}

async function syncFromSubscription(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const status = mapStripeSubscriptionStatus(subscription.status);
  const currentPeriodEndEpoch = subscription.items.data[0]?.current_period_end;
  const currentPeriodEnd = currentPeriodEndEpoch
    ? new Date(currentPeriodEndEpoch * 1000)
    : null;
  const planKey = subscription.items.data[0]?.price?.id ?? null;

  await db
    .update(ranches)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: status,
      subscriptionPlanKey: planKey,
      subscriptionCurrentPeriodEnd: currentPeriodEnd,
      subscriptionUpdatedAt: new Date(),
    })
    .where(eq(ranches.stripeCustomerId, customerId));
}

export async function POST(request: Request) {
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeWebhookSecret) {
    return new Response("Missing webhook secret", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const stripe = getStripeClient();
  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
  } catch {
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const ranchId = session.metadata?.ranchId;
        const customerId =
          typeof session.customer === "string" ? session.customer : null;
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : null;

        if (ranchId) {
          await db
            .update(ranches)
            .set({
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              subscriptionUpdatedAt: new Date(),
            })
            .where(eq(ranches.id, ranchId));
        }

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncFromSubscription(subscription);
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncFromSubscription(subscription);
        break;
      }

      default:
        break;
    }
  } catch {
    return new Response("Webhook handler failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
