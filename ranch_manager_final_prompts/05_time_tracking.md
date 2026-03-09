# Prompt 05 — Shift tracking + task/work-order time tracking

## Objective
Implement launch time tracking:
- shift start/end
- task/work-order clock in/out
- active state visibility
- history views
- guardrails against broken time state

This must feel dependable. If time tracking feels fragile, trust in the product drops fast.

## Constraints
- Keep the model understandable.
- Enforce state transitions carefully.
- Do NOT add advanced approvals yet.
- Do NOT add automation/scheduled background logic yet.
- Keep worker flow fast and obvious.

## Product rules
Support these core states:
- a worker can start a shift
- a worker can end a shift
- a worker can clock into assigned work during a shift
- task/work-order time must attach to the active ranch and relevant work order
- prevent obviously broken duplicate active states

## Tasks
1) Implement shift tracking domain.
- start shift
- end shift
- current active shift
- shift history for the current user
- manager visibility into current team shift state if practical

2) Implement task/work-order time tracking.
- start work on a work order
- stop work on a work order
- show active work item clearly
- preserve clean relationship to work order and user

3) Add state guardrails.
Examples:
- cannot end a task that is not active
- cannot start duplicate active shifts for the same user
- cannot start conflicting active work in an invalid way

4) Build the Time page(s).
- worker-friendly current state panel
- recent history
- clear calls to action
- good empty states

5) Make it visually strong.
This domain should feel focused and calm, not cluttered or stressful.

## Acceptance Criteria
- Worker can start/end shift and task time cleanly.
- App prevents obviously broken time states.
- Current active state is easy to understand.
- History is visible enough for launch.
- Build/lint/typecheck succeed.

## Output Format
- Files changed
- Commands to run
- How to verify (click-by-click)
