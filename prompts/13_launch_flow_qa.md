# 13_launch_flow_qa.md

## Objective
Run a focused launch-flow QA pass after the redirect, activation, checkout, and settings work is complete.

## Scope
This is not a redesign pass. It is a launch-readiness pass for:
- landing entry
- signup/login/onboarding
- billing activation
- checkout/trial behavior
- owner billing management
- protected-route behavior

## Tasks
1. Audit the full user path from first visit through app access.
2. Test and tighten these flows:
   - public landing page
   - signup
   - onboarding
   - unpaid user activation routing
   - checkout start
   - checkout success/cancel return
   - code redemption
   - valid access into `/app`
   - owner billing settings / manage-subscription
3. Fix rough redirect behavior, confusing copy, and obvious access-state dead ends.
4. Confirm non-owner users do not see owner billing controls.
5. Confirm billing-required and settings pages clearly explain next steps.
6. Update docs only if needed to reflect meaningful launch-flow changes.
7. Record verification steps in `status.md`.

## Guardrails
- No unrelated feature work.
- No broad visual redesign.
- No architecture rewrite.
- Stay focused on launch flow clarity and reliability.

## Acceptance Criteria
- Launch flow is coherent and predictable.
- Protected-route behavior is consistent.
- Activation and billing management are understandable.
- Lint, typecheck, and build remain clean.

## Deliverables
- Apply final QA fixes
- Record commands and verification notes
- Update `status.md` when complete