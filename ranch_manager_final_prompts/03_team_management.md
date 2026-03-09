# Prompt 03 — Team management

## Objective
Implement the team-management domain for launch:
- team list
- add member
- edit member
- activate/deactivate member
- role assignment
- pay type/pay rate assignment

This is an owner/manager-facing operational tool and must feel clean and trustworthy.

## Constraints
- Keep all mutations server-side and role-checked.
- Protect tenant boundaries.
- Do NOT add invitations by email if that creates unnecessary complexity right now.
- A simple add-member flow is acceptable for launch.
- Keep the UI polished and easy to scan.

## Data requirements
Add or finalize the fields needed for launch team management, including practical equivalents of:
- member display name
- email/username as needed
- active/inactive state
- role
- pay type
- pay rate
- timestamps/audit basics

## Tasks
1) Build the Team page.
Include:
- team table/list
- filters or quick tabs if practical
- good empty state
- clean detail/edit experience

2) Implement add member flow.
- create a member/user record path that fits the chosen auth approach
- attach the user to the active ranch
- default role should be safe

3) Implement edit member flow.
- role updates
- pay type updates
- pay rate updates
- active/inactive toggle

4) Add role-aware controls.
- worker cannot manage team
- manager/owner behavior should follow the chosen rules

5) Make the page feel production-ready.
- readable tables/cards
- clear actions
- no cramped forms
- no visually raw admin panel feel

## Acceptance Criteria
- Owner/manager can create and manage team members.
- Role/pay settings persist correctly.
- Worker cannot access team management.
- Team page feels sales-ready and trustworthy.
- Build/lint/typecheck succeed.

## Output Format
- Files changed
- Commands to run
- How to verify (click-by-click)
