# Stripe Billing Notes

## Required Environment Variables

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
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
