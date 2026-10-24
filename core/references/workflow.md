# SDD workflow and session ownership

For AI/model/retrieval changes and automation integrations, use
[AI workflow, acceptance and evidence](ai-workflow.md). ai-engineer and
automation-integration-agent implement assigned files; QA loads ai-evaluation and
security loads ai-security for independent review. Skills do not add reviewer roles.

1. Orchestrator delimits the objective. Software-architect resolves actual decision
   points; planner-agent proposes preliminary scope/checks without authorizing code.
   Capture before-copies including spec, configuration inputs and anticipated files,
   then run initial checks BEFORE any scoped edit. No Git repository is required.
2. Spec-writer owns the active spec under spec/. G0 verifies its configured checks
   and readiness. Missing initial spec/tool evidence cannot be used to waive errors.
3. Resume planner-agent to map approved acceptance to tasks, owners, dependencies,
   consumers and gates. Finalization may narrow the plan, never silently expand
   writes or waive acceptance. Config changes invalidate old diagnostic comparison;
   a newly selected failing check needs baseline reproduction before debt attribution.
4. Writers implement ready tasks. Coordinator extends baseline BEFORE newly scoped
   files are edited. Owner sessions are reused; references do not grant write access.
5. Coordinator runs G1–G4 for the delta. G0 must also be current at release. Gate
   commands may inspect entire dependent projects, but existing verified diagnostics
   do not block the delta. Changed acceptance and new failures always matter.
6. Code-review-agent independently challenges source, tests and evidence. QA,
   security and gate evaluator inspect the relevant acceptance/evidence. Repairs
   resume original owners; two ineffective cycles trigger root-cause diagnosis.
7. G5 aggregates current G0–G4 evidence and independent review artifacts. Final
   response distinguishes passed checks, unchanged debt and unresolved evidence.

## Session registry

One execution directory owns baseline, evidence and sessions.json. The registry is
coordination metadata, not an approval ledger or lock. It records real harness IDs
by harness + parentSession + role + owner slot; never by task ID alone.

Before spawning: lookup. If found, resume the exact ID with new objective/delta and
changed references. OpenCode uses task_id. Claude Code uses SendMessage to the
returned agent ID (or the installed version's explicit resume mechanism). Preserve
the parent session as required by the harness. Antigravity conversation handles and
other harness resume mechanisms must be confirmed in the running harness; never
invent tools. If unavailable/expired, record the reason and explicitly replace the
ID after a fresh launch. Reload only then, or when guidance actually changed.

The registry cannot launch/resume a remote agent itself; the coordinator must call
the harness tool. A stored ID is not evidence that the provider retained context.
Concurrent owners use distinct slots; serialize registry updates through coordinator.
Do not share a run across checkouts or unrelated objectives.

## Scope and old debt

Before evidence is accepted only when captured against the original baseline inputs
with the same check definition. Diagnostic comparison uses file, identity, severity,
message and context fingerprint, with multiplicity preserved. New or aggravated
findings block even in unchanged consumer files. Unstructured failures cannot be
waived as old debt. Necessary missing evidence remains BLOCKED.

A baseline is not a sandbox: it tracks explicitly selected files and their dependencies.
Include all relevant inputs in scope. Review ownership violations separately. Do not
run destructive commands to manufacture a baseline or reset user changes.
