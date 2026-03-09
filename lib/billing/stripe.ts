import Stripe from "stripe";

const globalForStripe = globalThis as { stripeClient?: Stripe };

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

export function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  if (!globalForStripe.stripeClient) {
    globalForStripe.stripeClient = new Stripe(key);
  }

  return globalForStripe.stripeClient;
}
