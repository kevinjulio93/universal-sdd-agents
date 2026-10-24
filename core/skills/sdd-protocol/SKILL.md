---
name: sdd-protocol
description: Shared ownership, handoff and evidence contract for an explicitly selected SDD execution.
---
# SDD protocol

Load once per session; retain on resume. Read targeted references only when needed.
Canonical capabilities are in roles.json. Readers never edit or execute shell.
Writers edit only assigned baseline-captured paths; coordinator runs checks.
No writer or reader delegates or executes checks through shell, MCP or remote tools.
Role skills and auxiliary skills cannot expand capabilities or assigned write paths.

## Handoff

Objective; active spec/acceptance IDs; exact assigned files; owner slot; dependencies;
relevant references; run directory; baseline manifest and before-directory paths;
current delta/evidence paths. References grant no write permission. Send only changes
on resume and identify guidance changes that require rereading.

## Results

- Writer: result, at most three grouped changes, proposed checks, actual blockers.
- Reader: verdict, findings (`severity`, `path:line`, evidence, impact, minimal fix), gaps.
- Planner: task/owner/path/dependency/acceptance/check table and applicability reasons.
- Coordinator: outcome, checks actually run, relevant debt and unresolved gaps.

Prefer 150 words except plans or multiple actionable findings. JSON is required
only for machine-readable gate artifacts, not conversational handoffs.
Never claim execution from a proposed command. Never substitute an agent's summary
for code/evidence review. Session reuse preserves context, not validity of old checks.
Orchestrator manages real session IDs and metadata; readers/writers return results
without persisting run artifacts. Preserve user/concurrent edits. No publishing,
paid calls, PII transfer or remote mutations without explicit scoped authorization
and an executor authorized for that operation. Prefer offline fixtures.
