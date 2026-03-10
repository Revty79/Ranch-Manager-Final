# Stripe Billing Notes

## Finalize Setup Checklist

1. Create a recurring Stripe Price for your subscription plan.
2. Set env vars in your deployment and local `.env`:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_ID` (prefer `price_...`; `prod_...` is supported if a default recurring price exists)
   - `STRIPE_WEBHOOK_SECRET`
   - `APP_URL` (must match your real app domain in production)
3. Configure Stripe webhook endpoint:
   - `https://<your-domain>/api/stripe/webhook`
4. Enable these webhook events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Restart the app after env changes.
6. Test with an owner account:
   - open `/checkout`
   - complete Stripe checkout
   - verify `/app/settings` shows updated subscription state
   - verify protected app routes are accessible

## Required Environment Variables

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID` (use a recurring price ID for subscriptions)
- `STRIPE_WEBHOOK_SECRET`
- `APP_URL` (used for checkout return URLs)
- `BILLING_COUPON_PEPPER` (optional; falls back to `APP_SECRET`)
- `PLATFORM_ADMIN_EMAILS` (required for `/admin` access)

## Webhook Endpoint

- URL path: `/api/stripe/webhook`
- Core synced events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

## Access Rules

- Paid access: `subscription_status` in `active` or `trialing`
- Free beta access: `beta_lifetime_access = true`
- Lifetime beta coupon codes are DB-backed and redeemable once per ranch
- Non-paid/non-beta users are routed to `/app/billing-required` for protected app routes

## Coupon Management

- Platform admins (emails in `PLATFORM_ADMIN_EMAILS`) can manage coupons at `/admin`.
- Coupon codes are hashed at rest and cannot be recovered from the database.
