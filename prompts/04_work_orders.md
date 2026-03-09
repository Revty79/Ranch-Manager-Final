# Prompt 04 — Work orders

## Objective
Implement the launch work-order domain:
- create work orders
- edit work orders
- assign work orders
- track status
- worker view of assigned work

This is one of the core value drivers of the product.

## Constraints
- Keep the model simple and useful.
- Do NOT build a giant project-management system.
- Prioritize clarity and operational usefulness.
- Work-order permissions must respect ranch and role context.

## Data requirements
Create the practical entities/fields needed for launch, including equivalents of:
- work order id
- title
- description/notes
- status
- priority (optional but helpful)
- assignees or assignments
- due date (optional if practical)
- created by
- ranch ownership
- timestamps

## Tasks
1) Build manager-facing work-order list and detail flows.
- list view
- create form
- edit form
- status updates
- assignment flow

2) Build worker-facing assigned work view.
- show active/open assigned work
- keep it clean and readable
- avoid manager-only clutter on worker screens

3) Add practical status model.
Use a small sensible set such as:
- draft
- open
- in progress
- completed
- cancelled

4) Add filtering/search if it is straightforward.

5) Make the UI strong.
- readable cards/tables
- clear status treatment
- visible actions
- useful empty states

## Acceptance Criteria
- Manager can create, edit, assign, and update work orders.
- Worker can see assigned work clearly.
- Status handling works and persists.
- UI looks credible enough to demo or sell.
- Build/lint/typecheck succeed.

## Output Format
- Files changed
- Commands to run
- How to verify (click-by-click)
