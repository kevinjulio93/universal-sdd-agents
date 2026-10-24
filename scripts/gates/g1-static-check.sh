#!/usr/bin/env bash
# G1 evidence runner. Usage: bash g1-static-check.sh --run=... --phase=before|after --config=...
set -euo pipefail
exec node "$(dirname "${BASH_SOURCE[0]}")/../gate.js" "$@" --gate=G1
