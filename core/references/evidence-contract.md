# Common gate contract v1

Every persisted G0–G5 result has `version`, `runId`, `gate`, `phase`, `status`,
`startedAt`, `finishedAt`, `configDigest`, `scope`, `baseline`, `checks`, `findings`,
`debt`, and `gaps`. `scope` contains explicit files, SHA-256 hashes, a current digest
and a baseline digest. Baseline paths are included for independent review.
Configuration failures emitted by the CLI use the same envelope with unknown
identity/scope/configuration fields set to null and status BLOCKED; they cannot
serve as release evidence.

- PASS: applicable checks executed successfully, no introduced/aggravated findings.
- FAIL: a demonstrated new/aggravated diagnostic or changed-line coverage failure.
- BLOCKED: missing tool, invalid configuration, unclassified failure, stale/incomplete
  report, mutation during validation or required independent review missing.
- NOT_APPLICABLE: explicit configuration and rationale; evaluator verifies it.

G5 approves only current G0–G4 results plus code-review-agent and
quality-gate-evaluator approvals covering all configured acceptance IDs. Additional
QA/security reviews can be required; their acceptance mapping must be reviewed
explicitly, as the runner does not enforce full ID coverage for these extra roles.
Artifacts are local evidence, not cryptographic
attestations: the coordinator must record the actual independent response, never
forge an approval. Integrity hashes detect accidental/stale changes, not a malicious
actor with write access to the entire run directory.

## Check definition

`command` is an argv array, executed without a shell from root or explicit `cwd`.
Commands must be read/check operations and may write reports, not scoped source.
`format` is `exit-code`, `json` or `coverage`. Timeout defaults to 120 seconds;
set `timeoutMs` explicitly for longer scans. Pin tool versions in the project.

An exit-code check can prove a clean run. A nonzero unstructured result is BLOCKED:
it cannot distinguish old failures from a regression. Use a structured adapter to
classify existing debt. No tool is downloaded automatically by the gate runner.

AI evaluations can use exit-code checks with a consumer-owned runner; there is no
special AI report format. Missing runner or nonzero evaluation is BLOCKED under
these semantics, never automatic approval. See [AI evidence](ai-workflow.md) for
sample design, remote model/input freshness, report hashes and live-test permission.
Local scope hashes alone do not capture remote model/retrieval/tool changes.

## Diagnostic producer

The runner supplies `SDD_RUN`, `SDD_ROOT`, `SDD_PHASE`, `SDD_RUN_ID` and
`SDD_SCOPE_DIGEST`. A producer must execute a fresh check and output one JSON object:

```json
{
  "complete": true,
  "runId": "<SDD_RUN_ID>",
  "scopeDigest": "<SDD_SCOPE_DIGEST>",
  "phase": "before",
  "diagnostics": [{
    "file": "src/example.ts",
    "line": 12,
    "rule": "rule-id",
    "severity": "error",
    "message": "Actual diagnostic",
    "fingerprint": "stable affected-code/context identity"
  }]
}
```

Fingerprints must represent the issue context, not just a line number or a stable
server issue ID that could hide aggravation. Severity/message changes and duplicate
findings are compared. Findings in consumers outside edited files still count when
new: changing a public contract can break an untouched caller. Scope must include
all relevant check inputs to invalidate stale evidence correctly.

`scripts/check.js` normalizes fresh Spectral/Semgrep output. Other linters/test
runners can implement the same contract. Never classify entire failing suites as
old because one known failure exists.

## Coverage producer

Use `format: coverage`, explicit `files`, `lineThreshold` and `branchThreshold`.
The report has the same provenance plus `coverage: [{file, lines:[{line,hits}],
branches:[{line,id,hits}]}]`. Only changed current lines enter the denominator.
Deleted lines have no coverage denominator; regression checks/review still apply.
No executable changed lines yields null coverage, not a fabricated 100%. Missing
coverage for a changed selected source file blocks the check.

For LCOV use `check.js --kind=lcov -- <producer>`. The producer executes tests and
writes a fresh LCOV to the unique `SDD_REPORT_PATH` supplied to it. Existing reports
are never accepted through a fallback search. Test failure blocks coverage.

## Sonar

`sonar-check.js` runs a fresh scanner with `sonar.qualitygate.wait=false`, waits for
that compute task, retrieves complete unresolved issue pages, and verifies that the
latest analysis is still the same. Before/after issues use the common comparison.
Historical global QG status never becomes a task failure by itself. This is an issue
snapshot, not a claim that the remote global QG passed. Configure separate coverage,
hotspot or duplication checks when required. Unsupported API/edition/schema or
concurrent analysis becomes BLOCKED; there is no silent local substitute.
