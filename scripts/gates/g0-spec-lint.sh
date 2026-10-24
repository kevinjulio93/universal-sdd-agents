#!/usr/bin/env bash
# G0 evidence runner. Usage: bash g0-spec-lint.sh --run=... --phase=before|after --config=...
set -euo pipefail
exec node "$(dirname "${BASH_SOURCE[0]}")/../gate.js" "$@" --gate=G0
