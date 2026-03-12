# 12_settings_customer_portal_and_cancel.md

## Objective
Improve the owner billing experience in settings and add a proper membership management / cancellation path.

## Current Context
The repo already has an owner-facing billing surface in `/app/settings` showing status and checkout-related messaging. This prompt should extend that surface, not replace it.

## Tasks
1. Audit the current billing section in `/app/settings`.
2. Add or improve clear display of current billing/access information where available.
3. Add a manage-subscription / cancel-membership path for owners.
4. Prefer Stripe Customer Portal integration if feasible with the current implementation.
5. Keep owner billing controls owner-only.
6. Preserve the distinction between:
   - Stripe recurring subscription access
   - internal beta/lifetime access via coupon code
7. If customer portal integration is added, keep the implementation simple and production-safe.

## Guardrails
- Do not build a custom cancellation engine if Stripe Customer Portal is a better fit here.
- Do not break existing settings functionality.
- Do not blur permanent access codes with Stripe discounts/subscriptions.
- Keep access checks and ownership checks intact.

## Acceptance Criteria
- Owners can clearly see their billing/access situation.
- Owners have a real path to manage or cancel their subscription.
- Existing beta/lifetime access remains functional.
- Settings feels launch-ready for billing management.

## Deliverables
- Implement settings billing improvements
- Add customer portal / cancel path if feasible
- Update `status.md` when complete