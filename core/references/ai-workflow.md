# AI workflow, acceptance and evidence

This extends the existing SDD workflow and common gate contract v1, not its schema.
There are 13 roles: ai-engineer and automation-integration-agent are implementers;
ai-evaluation and ai-security are skills, not agents. No ai-evaluation-agent is active.

## Routing and ownership

| Change | Implementation owner | Independent review and skill |
| --- | --- | --- |
| Models, prompts, RAG, AI agents, evaluation assets | ai-engineer | qa-agent loads ai-evaluation; security-agent loads ai-security |
| Webhooks, MCP/API connectors, n8n, meeting/calendar automations | automation-integration-agent | QA reviews functional acceptance; security loads ai-security; QA loads ai-evaluation if AI output is involved |
| Shared backend/UI/database contracts | Existing specialist with disjoint assigned paths | Existing code review plus applicable QA/security review |

Software-architect resolves boundaries; spec-writer owns acceptance under spec/;
planner-agent assigns tasks and exact files. Skills grant no permissions. Readers
remain read-only; implementers do not execute checks or approve their own evidence.
The coordinator runs authorized checks and resumes the original owner/reviewer.
Load only relevant skills; always retain sdd-protocol. For installed copies read
`.sdd/core/skills/<name>/SKILL.md` if native skill discovery is unavailable.

## Acceptance before implementation

Record acceptance IDs and an approved evaluation plan in scoped project files:

- Quality: anchored rubric, labeled dataset provenance/splits, held-out isolation,
  critical slices, absolute floors and maximum paired baseline regression.
- Statistics: independent cases per slice, repetitions, seeds/settings, confidence
  level, interval method and sample-size/power or precision rationale. Set stopping
  rules and multiplicity handling before running. Do not count repetitions as cases.
  For example, zero failures in 30 independent cases still gives an approximate
  one-sided 95% failure-rate upper bound of 10% (rule of three), not proof of safety.
- Judge: human calibration set separate from tuning/evaluation, agreement and
  false-accept thresholds, order-bias checks and human adjudication rules.
- Budgets: tokens, calls, currency/spend, retries, concurrency, wall time and p50/p95
  end-to-end latency; state cached/uncached conditions and pricing date. Evaluate
  cost per successful task as well as raw request cost.
- Security: injection/exfiltration negatives, tool/egress scopes, tenant isolation,
  PII handling and retention, meeting consent/revocation and side-effect approvals.

Choose numeric thresholds for the actual risk and workload; these documents supply
no universal passing score or fabricated dataset. Insufficient sample size,
uncalibrated judging or inaccessible required providers are evidence gaps, not N/A.
Separate baseline/candidate runs from training/tuning and audit leakage into prompts,
retrieval and judge examples. Include failures, timeouts and retries in denominators.

## Gates and consumer runner

Start from `../templates/checks.ai.example.json`. Every command path marked
`A_IMPLEMENTAR` is **A IMPLEMENTAR by the consumer**, not a shipped runner or an
existing npm script. Implement and version it, then replace the argv paths with
actual project commands. The template is configuration, never execution evidence.

| Gate | Consumer command obligation |
| --- | --- |
| G0 / spec | Validate acceptance IDs, numeric thresholds, sample design, budgets, provenance and permission requirements |
| G1 / static | Validate prompt/config assets, code and secret/PII controls without calling providers |
| G2 / contracts | Verify model output/tool schemas, authorization, connector contracts and compatibility |
| G3 / integration | Exercise retrieval, tool routing, tenant boundaries, consent, retries and idempotency; distinguish mocks from live calls |
| G4 / evaluate | Run actual held-out baseline/candidate evaluations, calibrated judging, confidence, quality, cost and latency thresholds |
| G4 / security | Exercise injection, exfiltration, tenant/PII and consent controls against the required real integration |

Checks use supported `format: exit-code`, with no new `ai` format or gate fields.
The consumer runner must fail closed: return 0 only after all assigned thresholds,
completeness and provenance checks succeed; nonzero for violations, missing samples,
missing permission, unavailable tools/providers or budget exhaustion. Emit explicit
reasons. Current exit-code semantics map any nonzero result to BLOCKED, not a
classified FAIL; it cannot be waived as old debt. A missing runner is BLOCKED.
For diagnostic FAIL/debt attribution a consumer can instead implement the existing
`json` diagnostic producer contract with comparable before evidence. Arbitrary
evaluation JSON is not a supported diagnostic format. Do not map an uncertain
score to a fake source finding simply to obtain FAIL.

Capture baseline and before checks before edits, including code, prompts, runner,
lockfiles, evaluation plan, dataset manifests and retrieval/tool configuration.
Run current after checks for G0-G4. Mark a gate N/A only with an explicit reviewed
acceptance-based reason; lack of a runner or budget is not such a reason. G5 still
requires code-review-agent and quality-gate-evaluator and, in this example, QA and
security. Record genuine reviews via review.js; do not create template approvals.
Map QA and security reviews to the applicable acceptance IDs explicitly; the gate
engine does not assess the semantic completeness of their acceptance coverage.

## Evidence and remote freshness

The runner must create fresh reports under the run evidence directory and emit
their paths and SHA-256 digests into its captured stdout log. This is a consumer
report convention, not a new gate schema. Include:

- `SDD_RUN_ID`, `SDD_SCOPE_DIGEST`, `SDD_PHASE`, timestamps, actual command, runner
  and dependency versions, environment and baseline/candidate identities.
- Provider, endpoint/deployment, exact model revision when available, decoding
  settings, prompt/template hashes, dataset/split/label hashes and rubric/judge
  model/prompt/calibration hashes. Never substitute an alias for a known revision.
- Retrieval corpus snapshot/hash, index version, embedding model, filters, tenant
  scope and top-k; tool/MCP schema hashes, server/connector versions, destinations,
  permissions and remote workflow revision. Hash redacted manifests, never secrets.
- Per-case/repetition outcomes, redacted request IDs/traces, aggregate counts and
  intervals per slice, judge disagreements, tokens, cost, latency, errors/retries,
  actual sample sizes, thresholds and all incomplete/skipped cases.

Baseline hashes cover local files only. Gate/G5 does not automatically query remote
versions or validate a consumer report's claims. Pin snapshots where possible;
have the runner resolve/check remote identities before and after evaluation and
block on drift. If a provider exposes no immutable revision, record that limitation,
time/request IDs and an approved freshness window; do not claim reproducibility.
Changed models, prompts, datasets, retrieval or tools require fresh checks/reviews,
even when the local source hash is unchanged. Reviewers must verify this explicitly.

G5 hashes command logs, not arbitrary files mentioned within stdout. Reviewers must
inspect and reference actual consumer reports in review.js `evidence` as well as
gate artifacts; report files must reside inside the run directory. This binds their
bytes to the review. Retain access-controlled redacted traces; hashes alone do not
prove a provider was called. Mocks validate wiring, not real LLM quality or security;
label them as mocks and keep required live acceptance BLOCKED until actually tested.

## Live execution and side effects

No example command grants live permission. Obtain explicit permission for provider
calls, data transfer, target environment/tenants, identities, allowed tools/endpoints
and spend/call/time limits before running. The runner must enforce these limits;
a gate timeout alone does not cancel remote jobs, cap spend or undo side effects.
Use isolated test tenants, synthetic/redacted data and least-privilege credentials.
Sending messages, joining/recording meetings, inviting users, writing records or
triggering workflows needs explicit side-effect authorization in addition to test
permission and meeting consent. Default to denied/dry-run; document cleanup,
idempotency, cancellation and any irreversible effects. Never auto-enable live mode
because credentials happen to exist. Checks may write reports, not scoped source;
authorized live effects must stay in isolated test systems, not production actions.

## Promotion criteria

ai-evaluation remains a QA skill. Consider a separate ai-evaluation-agent only when
all of the following are documented and approved, never automatically:

1. At least three completed AI changes show a recurring independent evaluation
   workload, with recorded QA bottlenecks or specialist findings and evidence links.
2. An approved responsibility/ownership matrix gives the proposed reader a distinct
   scope without duplicating QA, security or quality-gate-evaluator approval.
3. A versioned consumer runner and held-out suites reproduce quality, cost, latency
   and security results with declared sample design and calibrated judging; a pilot
   demonstrates useful independent findings without self-approval.
4. The user approves a spec/ADR for the new role, capability limits, review routing
   and migration. This document is not that authorization.

Only then update core/roles.json, agent/skill prompts, session registry validation,
review/config/release allowlists (currently only the existing four reviewer roles),
compiler-generated adapters and delegation permissions, deployment/discovery and
role-count/permission/review/session tests plus README. Verify all harnesses and
failure paths before enabling the role; do not add it to requiredReviews today.
