# 10_billing_required_activation_hub.md

## Objective
Turn the existing `/app/billing-required` route into the real activation hub for launch rather than leaving it as a thin access-state shell.

## Current Context
The repo already has:
- `/app/billing-required`
- checkout form
- coupon / beta lifetime code redemption
- settings billing surface

This prompt should build on those pieces and centralize first-time activation in the existing billing-required area.

## Tasks
1. Audit the current `/app/billing-required` page and supporting components.
2. Expand that page so it clearly becomes the activation screen for owners without valid access.
3. Reuse existing billing components where possible:
   - checkout form
   - coupon / beta-lifetime code form
4. Present the next steps clearly:
   - start subscription
   - redeem valid access code
   - understand why access is blocked
5. Keep owner-only billing actions owner-only.
6. Non-owner users who hit billing-required should see a clear explanation of what to do next instead of broken or misleading controls.
7. If helpful, add links back to settings or support messaging, but keep the page focused on activation.

## Guardrails
- Do not invent a second billing flow.
- Do not duplicate forms unnecessarily.
- Reuse existing components and helpers.
- Keep the page launch-clear, not overdesigned.

## Acceptance Criteria
- `/app/billing-required` clearly explains the blocked state.
- Eligible owners can activate access from this page.
- Beta/lifetime code redemption is available here if appropriate.
- The activation hub feels like the intended next step after auth/onboarding.

## Deliverables
- Implement activation-hub improvements
- Reuse current billing pieces where practical
- Update `status.md` when complete