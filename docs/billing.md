# Stripe Billing Notes

## Required Environment Variables

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `APP_URL` (used for checkout return URLs)
- `BETA_LIFETIME_CODE` (optional internal beta-code flow)

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
- Non-paid/non-beta users are routed to `/app/billing-required` for protected app routes
