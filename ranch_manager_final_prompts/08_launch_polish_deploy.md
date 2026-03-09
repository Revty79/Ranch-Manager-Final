# Prompt 08 — Launch polish + deploy readiness + demo confidence

## Objective
Take Ranch Manager Final from “feature complete enough” to “launch-ready enough”:
- polish UX
- reduce rough edges
- improve demo confidence
- prepare for deployment

The product should feel credible to show, credible to test, and credible to sell.

## Constraints
- Focus on launch-critical polish.
- Do NOT open new major feature branches.
- Fix rough edges that affect trust, clarity, or conversion.
- Keep changes scoped and shippable.

## Tasks
1) Polish launch-critical UX.
- empty states across core pages
- loading states across core pages
- error states across core pages
- access-denied and billing-required polish
- cleaner confirmation flows
- clearer success/error messaging

2) Improve visual finish.
- spacing consistency
- typography consistency
- button hierarchy
- table/card readability
- dashboard polish
- public page polish

3) Add basic support/admin sanity where needed.
- better handling for weird access state
- safe admin override visibility if already built
- clearer owner/account visibility

4) Add seed/demo data path if practical.
- a safe non-production method for demo data is acceptable
- keep it well-controlled and documented

5) Prepare for deployment.
- production env documentation
- README run/deploy steps
- migration steps
- build sanity
- Render-oriented deployment notes if helpful

6) Perform a launch walkthrough pass.
The product should support this end-to-end flow:
- visit landing page
- understand pricing/value
- sign up
- create ranch
- add team member
- create work order
- track time
- review payroll
- reach billing/account state cleanly

## Acceptance Criteria
- App feels noticeably more polished than the prior prompt.
- Core launch flow can be demoed without embarrassment.
- Deployment steps are documented and practical.
- README is accurate.
- Build/lint/typecheck succeed.

## Output Format
- Files changed
- Commands to run
- How to verify (demo script steps)
