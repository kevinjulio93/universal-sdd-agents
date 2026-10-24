# Harness capabilities and limits

Canonical source: roles.json. Run scripts/sync.js to regenerate adapters. Do not
edit generated permission headers. Model choice is intentionally left to the user.

| Harness | Enforced by generated adapter | Limits |
| --- | --- | --- |
| OpenCode | Per-agent mode; readers deny edit/bash/task; writers deny bash/task; coordinator delegates only named roles and asks for shell commands | Dynamic assigned-file scope is procedural for general writers. spec-writer has spec/** edit patterns. Shell permission is not an OS sandbox: an approved command can write files. Parent permissions may further restrict children. |
| Claude Code | Native tools allowlists and disallowedTools; readers lack edit/shell/Agent; writers lack shell/Agent; coordinator uses named Agent allowlist when main via --agent orchestrator | Per-task path ownership and coordinator shell scope need review/user permissions. Agent type allowlists apply when main, not nested. MCP/tools outside the allowlist are excluded; do not use bypassPermissions. |
| Cursor | Generated scoped role/protocol rules and canonical capability manifest | This adapter does not enforce per-role tool denial, file ownership or durable subagent resume. Rules are advisory. Verify native capabilities before autonomous parallel writing. |
| Windsurf | Generated protocol/role references and capability manifest | Same advisory limits; no claimed native per-role permission enforcement or guaranteed resume. |
| Antigravity | Generated role prompts and narrowed advertised tool lists | Tool declarations are not a verified security boundary. No claimed equivalent to OpenCode permission denial; verify installed runtime and available conversation-resume APIs. |

All harnesses: exact dynamic file assignments need coordinator/reviewer verification.
Global Cursor/Windsurf/Antigravity discovery is not assumed: import the installed
rules explicitly if the harness does not discover them. Prefer project deployment.
No blanket shell approval, secret interpolation or global settings overwrite is needed
to install SDD. Generated agents do not choose/approve their own gate evidence.

## Resource paths and authorization

Installed shared references use `.sdd/core/references/` from the project root, not
from native skill directories such as `.claude/skills/`. Global deployment rewrites
`.sdd/` references in Markdown to absolute paths under the installation target's
`.sdd/global/`; do not resolve them against the current consumer project.

OpenCode access to run directories under the system temporary directory or global
resources outside the workspace may require `external_directory: ask` in the
effective native permissions. Request narrowly scoped access to the actual run or
resource directory when prompted; read permission alone does not authorize external
directory access. An unlisted permission may remain denied by the generated default
deny policy: inspect the installed configuration and obtain user authorization for
the needed setting rather than claiming it is already granted. Do not blanket-allow
the home directory or all temporary resources, and do not bypass parent restrictions.

Filesystem permission is separate from provider/MCP authentication and operation
authorization. If reading remote documentation or performing an approved check
requires authentication or additional access, request authorization through the
harness's supported mechanism; do not invent credentials, expose tokens in evidence
or treat successful authentication as permission for paid calls or side effects.
Unavailable authorization leaves the affected check BLOCKED.

OpenCode loads configuration at startup: quit and restart after deployment. Claude
Code may require restart when its agents directory is newly created. For an existing
installation of the old software-architect-orchestrator, disable/remove that obsolete
agent after checking user customizations; installers do not silently delete it.
