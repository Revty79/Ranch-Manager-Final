# Prompt 06 — Payroll summary + export

## Objective
Implement the launch payroll layer:
- hours totals
- pay calculation display
- payroll summary views
- exportable payroll data

This is not full payroll processing software. It is the operational payroll summary/export layer for launch.

## Constraints
- Keep calculations transparent.
- Do NOT build a tax engine.
- Do NOT build deep accounting.
- Keep period selection practical and clear.
- Keep exports useful.

## Data / rules requirements
Support the pay configuration chosen in team management.
At launch, calculations can stay simple and honest.
If the pay model is currently limited, show that clearly in the UI.

## Tasks
1) Build payroll summary screens for owner/manager roles.
Include:
- date range/pay period selection
- per-user hours totals
- pay rate/pay type visibility
- estimated pay totals

2) Build export.
- CSV export at minimum
- filename should be sensible
- export should match visible summary data

3) Make calculation display understandable.
- avoid black-box totals
- show enough supporting detail to inspire trust

4) Keep the UI polished.
- readable table layout
- summary cards if useful
- empty state when no time exists

5) Add any small schema updates needed to support clean summaries.

## Acceptance Criteria
- Manager can review payroll summaries for a selected period.
- Export works and is useful.
- Totals are understandable, not mysterious.
- UI feels business-ready for launch.
- Build/lint/typecheck succeed.

## Output Format
- Files changed
- Commands to run
- How to verify (click-by-click)
