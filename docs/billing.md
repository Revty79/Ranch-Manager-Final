# Stripe Billing Notes

## Finalize Setup Checklist

1. Create a recurring Stripe Price for your subscription plan.
2. Set env vars in your deployment and local `.env`:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_ID` (prefer `price_...`; `prod_...` is supported if a default recurring price exists)
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_TRIAL_DAYS` (optional whole-number day count for first checkout trial)
   - `APP_URL` (must match your real app domain in production; localhost here will send Stripe return URLs to localhost)
3. Configure Stripe webhook endpoint:
   - `https://<your-domain>/api/stripe/webhook`
4. Enable these webhook events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Configure Stripe Customer Portal in Dashboard so owners can manage/cancel from `/app/settings`.
6. Restart the app after env changes.
7. Test with an owner account:
   - open `/checkout`
   - complete Stripe checkout
   - verify `/app/settings` shows updated subscription state
   - verify protected app routes are accessible

## Required Environment Variables

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID` (use a recurring price ID for subscriptions)
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_TRIAL_DAYS` (optional; when set, eligible first checkout sessions start with a Stripe trial)
- `APP_URL` (used for checkout/portal return URLs; set this to your live app domain in production)
- `BILLING_COUPON_PEPPER` (optional; falls back to `APP_SECRET`)
- `PLATFORM_ADMIN_EMAILS` (required for `/admin` access)

## Webhook Endpoint

- URL path: `/api/stripe/webhook`
- Core synced events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

## Customer Portal

- Owners can launch Stripe Customer Portal from `/app/settings` once a Stripe customer exists.
- Portal return path: `/app/settings?billing=portal_return`.
- Use portal for payment updates, invoice history, and cancellation.

## Access Rules

- Paid access: `subscription_status` in `active` or `trialing`
- Free beta access: `beta_lifetime_access = true`
- Lifetime beta coupon codes are DB-backed and redeemable once per ranch
- Non-paid/non-beta users are routed to `/app/billing-required` for protected app routes
- Trial eligibility: ranch is `inactive`, has no prior Stripe subscription ID, and does not already have beta lifetime access

## Coupon Management

- Platform admins (emails in `PLATFORM_ADMIN_EMAILS`) can manage coupons at `/admin`.
- Coupon codes are hashed at rest and cannot be recovered from the database.
