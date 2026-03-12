# 11_trial_support_and_checkout_cleanup.md

## Objective
Audit the current Stripe checkout flow and add or clean up trial support if it fits the launch plan cleanly.

## Current Context
The repo already has:
- Stripe checkout session creation
- Stripe webhook sync
- access logic that already recognizes `trialing`
- billing-required routing
- settings billing messages

At present, the codebase appears prepared to understand trialing access state, but the checkout flow must be audited to confirm whether trial creation is actually implemented.

## Tasks
1. Audit current Stripe checkout/session creation and webhook handling.
2. Determine whether a true Stripe-backed trial is already implemented.
3. If not implemented and feasible cleanly, add launch-ready trial support.
4. Keep trial behavior aligned with the existing access model and webhook sync.
5. If trial is implemented:
   - ensure first eligible users can start it cleanly
   - ensure resulting access state is reflected correctly
   - ensure success/cancel messaging remains understandable
6. If trial is not feasible to finish safely in this pass, do not fake it:
   - leave checkout clean
   - document what remains
7. Clean up any obvious checkout confusion or edge-case messaging while staying within billing scope.

## Guardrails
- Do not replace Stripe checkout with a homegrown flow.
- Do not break current paid subscription flow.
- Do not bypass webhook truth with frontend-only assumptions.
- Keep changes incremental.

## Acceptance Criteria
- Checkout flow remains functional.
- Trial support is either truly implemented cleanly or explicitly deferred without damaging billing flow.
- Access state handling remains consistent with Stripe/webhook updates.
- User-facing checkout messaging is clearer for launch.

## Deliverables
- Implement trial support if feasible
- Otherwise leave a clean documented state
- Update `status.md` when complete