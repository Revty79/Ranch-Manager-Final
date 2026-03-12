# 09_post_auth_redirects_to_activation.md

## Objective
Continue from the current Ranch Manager implementation and fix the post-auth flow so users who do not yet have valid billing access are routed directly into activation instead of first landing in the dashboard area.

## Current Context
The repo already has:
- public landing page
- login/signup
- onboarding
- `/app`
- `requirePaidAccessContext()`
- `/app/billing-required`
- Stripe checkout and webhook sync
- beta/lifetime access support

Current logic already redirects unauthenticated users to login and incomplete users to onboarding. However, onboarded users currently resolve post-auth redirect to `/app`, and billing gating only happens after app entry. This prompt should tighten that flow, not rebuild it.

## Tasks
1. Audit current post-auth redirect logic after:
   - login
   - signup
   - onboarding completion
2. Update the redirect behavior so that:
   - users who still need onboarding continue to go to `/onboarding`
   - onboarded users without valid billing access go directly to `/app/billing-required`
   - users with valid billing access go to `/app`
3. Reuse the current billing-access helper and existing access model.
4. Keep current auth/session/tenancy architecture intact.
5. Make the redirect behavior easy to follow in code.

## Guardrails
- Do not rewrite auth.
- Do not create a new onboarding system.
- Do not create a new billing gate route unless truly necessary.
- Reuse existing helpers and route structure.

## Acceptance Criteria
- New or returning users without valid access are sent directly into activation flow instead of bouncing through `/app`.
- Users with valid access still land in `/app`.
- Onboarding behavior remains correct.
- Existing paid/beta-lifetime access logic still works.

## Deliverables
- Implement redirect updates
- Keep code comments concise if needed for clarity
- Update `status.md` when complete