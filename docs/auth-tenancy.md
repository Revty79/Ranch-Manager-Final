# Auth + Tenancy Foundation

## Core Model

- `users`
  - credential identity (`email`, `password_hash`)
  - onboarding state (`needs_ranch`, `complete`)
  - last active ranch reference (`last_active_ranch_id`)
- `ranches`
  - tenant workspace identity (`name`, `slug`)
  - onboarding completion marker
  - subscription/access baseline fields
- `ranch_memberships`
  - user-to-ranch relationship
  - launch roles: `owner`, `manager`, `worker`
  - unique ranch/user membership constraint
- `sessions`
  - secure token hash per session
  - expiration timestamp

## Flow

1. User signs up with hashed password.
2. Session token cookie is created and stored as hash in DB.
3. User completes onboarding by creating ranch workspace.
4. Ranch membership is created with `owner` role.
5. App routes read current user, ranch, and membership on the server.
6. Role checks gate protected pages and server actions.
