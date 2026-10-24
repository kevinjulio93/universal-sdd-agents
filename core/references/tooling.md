# Tooling usage

Requires Node.js >=22. Run from the target checkout. Examples below assume an
installation under `.sdd/`; in the source repository use `scripts/` and `core/`.
No Git commands, resets or commits are needed.

## Baseline

```bash
node .sdd/scripts/baseline.js --files=src/example.ts,tests/example.test.ts
```

Keep the returned `directory` as RUN. Include dependency/configuration inputs in
the file list. New files are recorded as missing. Capture BEFORE editing. Extend:

```bash
node .sdd/scripts/baseline.js --run=/absolute/sdd-run-... --files=src/another.ts
node .sdd/scripts/baseline.js --delta=/absolute/sdd-run-...
```

Before-copies cannot be overwritten. Extensions invalidate old scope-bound results
and reviews. Plan scope early; before diagnostics require the original inputs. If
an extension requires broader old diagnostics after edits, reproduce those checks
in a separate baseline checkout rather than relabeling the modified tree as before.
The current CLI intentionally blocks such unverifiable before capture.
Keep the temporary run until review is complete; remove only its known directory
using normal user-approved filesystem tooling when no longer needed.

## Sessions

```bash
node .sdd/scripts/sessions.js --run=/absolute/sdd-run-... --harness=opencode --parent=actual-parent-id --role=frontend-agent --slot=ui
```

If `action` is `spawn`, launch the named role via the native harness. Register the
ID actually returned using the same arguments plus `--id=actual-child-id`.
Next lookup returns `action: resume` and OpenCode `task_id`; pass it to the Task
tool, including for a different task owned by the same slot. Claude returns
`recipient` for SendMessage. If unavailable/expired, explicitly replace with
`--id=new-actual-id --replace-reason=...`. The helper does not invoke harness APIs.

## Configure checks

Use `core/templates/checks.example.json` as a starting point, not as proof of a
project's acceptance. Set commands and applicability for every gate, all acceptance
IDs and extra review roles. Avoid adding report files to the baseline.

For AI work use `core/templates/checks.ai.example.json` and
[AI workflow](ai-workflow.md). Paths marked `A_IMPLEMENTAR` are **A IMPLEMENTAR by
the consumer**; no AI runner or npm scripts are supplied by that template. Missing
runners are BLOCKED. G0-G4 use existing formats, with QA/security reviews in addition
to the mandatory code/gate reviews. Mocks are not real LLM acceptance evidence.
Do not execute provider calls or live side effects without explicit permission and
enforced budgets. Example npm commands in the general template also require actual
consumer scripts; they are not installed by SDD.

Capture before-phase diagnostics before ANY scoped writes. A before FAIL recording
existing findings is expected and retained; BLOCKED means no usable baseline for
that check. If spec preparation must happen first, complete it as a separate SDD
execution, then start the implementation baseline from the approved spec.

```bash
node .sdd/scripts/gate.js --gate=G1 --phase=before --run=/absolute/sdd-run-... --config=.sdd/checks.json
# Implement assigned tasks, then:
node .sdd/scripts/gate.js --gate=G1 --phase=after --run=/absolute/sdd-run-... --config=.sdd/checks.json
```

Repeat for applicable G0–G4; after evidence for explicit NOT_APPLICABLE gates is
also required. Each result includes baseline paths for the review handoff. A later
source/config change invalidates old evidence. The wrappers in scripts/gates accept
the same named options; the former positional defaults are intentionally removed.

For diagnostics, examples of check argv:

```json
["node", ".sdd/scripts/check.js", "--kind=semgrep", "--", "semgrep", "scan", "--json", "--config", ".sdd/tools/semgrep.yaml", "src"]
```

```json
["node", ".sdd/scripts/sonar-check.js", "--project=my-project", "--branch=my-isolated-branch"]
```

Pass Sonar credentials only through SONAR_HOST_URL / SONAR_TOKEN. Use an isolated
project/branch when others are analyzing concurrently. Sonar check timeout should
cover scanner plus processing, e.g. `timeoutMs: 660000`.

## Review and release

Give independent reviewers objective/spec, delta, baseline manifest/beforeDirectory,
actual gate artifacts and acceptance IDs. Store their actual response in a JSON input:

```json
{
  "role": "code-review-agent",
  "harness": "opencode",
  "parent": "actual-parent-id",
  "slot": "default",
  "sessionId": "actual-registered-reviewer-id",
  "verdict": "APPROVED",
  "findings": [],
  "acceptance": ["AC-01"],
  "evidence": ["evidence/G0.after.json", "evidence/G1.after.json", "evidence/G2.after.json", "evidence/G3.after.json", "evidence/G4.after.json"],
  "reason": "Actual reviewer rationale, not a template approval"
}
```

```bash
node .sdd/scripts/review.js --run=/absolute/sdd-run-... --input=/absolute/reviewer-response.json
node .sdd/scripts/gate.js --gate=G5 --run=/absolute/sdd-run-... --config=.sdd/checks.json
```

Repeat recording for quality-gate-evaluator and configured QA/security reviewers.
G5 does not launch reviewers or verify provider transcripts; recording the genuine
response is the coordinator's responsibility. No evidence means no approval.
