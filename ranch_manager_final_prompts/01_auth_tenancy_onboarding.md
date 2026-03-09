# Prompt 01 — Auth + tenancy + onboarding foundation

## Objective
Implement the secure product foundation:
- authentication
- ranch/account creation
- tenant-safe membership model
- roles/permissions baseline
- onboarding flow into the app

This prompt creates the product skeleton that all later features depend on.

## Constraints
- Keep security and tenant separation first-class.
- Keep implementation understandable and maintainable.
- Do NOT add OAuth unless it is truly the simplest stable option.
- Do NOT add expansion modules.
- Do NOT add Stripe logic yet.
- Do NOT make authorization decisions in client-only code.

## Data model requirements
Create the core tables/entities needed for launch, including practical equivalents of:
- users
- ranches
- ranch_memberships
- roles
- subscription/access state fields on ranch or account
- beta lifetime access flag on ranch or account
- onboarding state fields

Use UUID-style primary keys or another production-safe equivalent.

## Role model
Support these launch roles:
- owner
- manager
- worker

Basic expectations:
- owner has full ranch control
- manager has operational control without ownership-level billing power unless explicitly granted
- worker has limited access to assigned work and personal time views

## Tasks
1) Implement auth.
- secure signup
- secure login/logout
- password hashing and session handling
- route protection for app pages
- redirect flows that feel sane and polished

2) Implement ranch creation during onboarding.
- first user can create a ranch/account
- that user becomes owner
- onboarding should feel short and clear

3) Implement membership + tenant context.
- all app data later must flow through active ranch context
- create server helpers for current user/current ranch/current membership
- centralize authorization checks where possible

4) Implement role-aware guards.
- protect routes and server actions by membership role
- create friendly access-denied states

5) Create initial app entry experience.
- authenticated user lands in the app cleanly
- incomplete onboarding routes user into setup
- completed onboarding routes user into dashboard/app home

6) Add minimal settings/account surface needed now.
- show ranch name
- show current user identity
- show current role

7) Add migrations/schema docs needed for the rest of the queue.

## Acceptance Criteria
- A new user can sign up, create a ranch, and become owner.
- Protected app routes require authentication.
- Tenant context exists and is server-safe.
- Roles are enforced at a baseline level.
- Onboarding feels clean and not overly long.
- Build/lint/typecheck succeed.

## Output Format
- Files changed
- Commands to run
- How to verify (click-by-click)
