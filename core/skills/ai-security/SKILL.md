---
name: ai-security
description: Audit AI trust boundaries, injection, tool permissions and sensitive-data handling under security-agent ownership.
---
# AI security

Load with security-agent when models, retrieval, tools or AI automations change.
ai-engineer and automation-integration-agent may consult it for implementation;
independent approval remains with security-agent. No additional execution rights.
Read `.sdd/core/references/ai-workflow.md` from the project root for permission and
evidence requirements, not relative to this skill's native directory.

- Trace system/user inputs, retrieved documents, attachments, meeting transcripts,
  tool results and memory as separate trust boundaries. Test direct, indirect and
  multi-turn prompt injection; retrieved instructions never authorize privileged acts.
- Enforce least privilege in code/tool gateways: allowlisted tools, destinations,
  schemas, identities and per-operation scopes; validate arguments and outputs.
  Model refusals and prompt delimiters are not authorization or a sandbox.
- Test exfiltration through URLs, webhooks, logs, citations, encoded output and tool
  calls; restrict egress, redact credentials and prevent untrusted endpoint selection.
  Include SSRF and confused-deputy cases without using real secrets as canaries.
- Enforce tenant authorization before retrieval, cache, memory and tool access;
  negative-test cross-tenant identifiers, indexes, sessions and cached answers.
  A model-side tenant instruction cannot replace server-side isolation.
- Minimize PII in prompts, datasets and traces. Verify provider retention/training,
  region, encryption, access, deletion and redaction against approved policy.
  Missing policy/consent evidence blocks the affected acceptance.
- For meetings, verify participant notice and explicit consent as required by policy
  and jurisdiction before recording/transcription or bot joining; test refusal,
  revocation, retention/deletion and recipient restrictions. No implicit consent
  from an invite, calendar access or possession of a transcript.
- Require explicit permission, isolated test identities, spend/call/time budgets and
  destination allowlists before live tests. Sending messages, inviting bots, changing
  records or triggering workflows needs separate explicit side-effect authorization.
  Verify replay/idempotency, duplicate events, approval bypass and kill switches.

Request checks through the coordinator. Report attacks attempted, actual traces,
enforced controls and residual risks without exposing PII. Mocks and static scans
alone do not prove real-model injection resistance. No evidence means BLOCKED,
not an invented clean bill of health or permission to run an attack.
