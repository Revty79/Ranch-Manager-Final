import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { ranches } from "@/lib/db/schema";
import { getStripeClient } from "@/lib/billing/stripe";
import { syncRanchFromSubscription } from "@/lib/billing/stripe-sync";

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
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const ranchId = session.metadata?.ranchId;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;

        if (ranchId) {
          const sessionUpdate: {
            subscriptionUpdatedAt: Date;
            stripeCustomerId?: string;
            stripeSubscriptionId?: string;
          } = {
            subscriptionUpdatedAt: new Date(),
          };

          if (customerId) {
            sessionUpdate.stripeCustomerId = customerId;
          }

          if (subscriptionId) {
            sessionUpdate.stripeSubscriptionId = subscriptionId;
          }

          await db
            .update(ranches)
            .set(sessionUpdate)
            .where(eq(ranches.id, ranchId));
        }

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncRanchFromSubscription(subscription, { ranchIdHint: ranchId });
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const ranchId = subscription.metadata?.ranchId ?? null;
        await syncRanchFromSubscription(subscription, { ranchIdHint: ranchId });
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
