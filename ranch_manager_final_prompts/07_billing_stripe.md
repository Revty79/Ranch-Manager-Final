# Prompt 07 — Stripe billing + subscription gating + lifetime beta access

## Objective
Implement paid access for launch:
- Stripe product/price wiring
- checkout flow
- webhook handling
- subscription state sync
- gating of paid app access
- durable lifetime beta access for approved testers

This prompt turns the product into a real paid SaaS.

## Constraints
- Keep the paid path simple.
- Keep billing logic server-side.
- Do NOT make the product depend on manual payment collection.
- Beta users must be able to stay free without fragile hacks.
- Do NOT overbuild multi-plan complexity unless it is clearly needed.

## Billing model
Launch with a simple model:
- one paid subscription path is enough
- optional future expansion can come later

The product must support two durable access states:
1) normal paid subscription access via Stripe
2) lifetime beta access for approved testers

## Important rule
Do NOT rely only on Stripe coupons to preserve beta access long-term.
Implement a durable internal access concept such as a `beta_lifetime_access` flag or equivalent.

A promo/invite code path may exist if helpful, but the app itself must understand lifetime beta access.

## Tasks
1) Finalize subscription/access fields in the schema.
Support practical equivalents of:
- subscription status
- plan identifier
- current billing state timestamps as needed
- beta lifetime access boolean/flag

2) Implement Stripe checkout path.
- public CTA into checkout
- successful return path
- failure/cancel path

3) Implement webhook handling.
Sync subscription events back into the app safely.

4) Implement paid access gates.
- unpaid user sees billing-required state
- paid user gets app access
- beta lifetime user gets app access without normal billing dependency

5) Add owner-facing subscription/account surface.
At minimum:
- current access state
- plan display
- billing status messaging

6) Keep the UX polished and trustworthy.
Billing pages/states should feel clear, calm, and professional.

## Acceptance Criteria
- A normal customer can complete checkout and gain access.
- Webhooks update subscription state safely.
- An unpaid account is gated correctly.
- A beta lifetime account keeps access without payment.
- Billing states are understandable.
- Build/lint/typecheck succeed.

## Output Format
- Files changed
- Commands to run
- How to verify (click-by-click)
