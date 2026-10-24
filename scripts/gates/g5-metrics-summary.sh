#!/usr/bin/env bash
# G5 release evidence/review runner. Usage: bash g5-metrics-summary.sh --run=... --phase=after --config=...
set -euo pipefail
exec node "$(dirname "${BASH_SOURCE[0]}")/../gate.js" "$@" --gate=G5
