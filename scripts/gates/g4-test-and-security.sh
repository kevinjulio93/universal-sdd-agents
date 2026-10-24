#!/usr/bin/env bash
# G4 evidence runner. Usage: bash g4-test-and-security.sh --run=... --phase=before|after --config=...
set -euo pipefail
exec node "$(dirname "${BASH_SOURCE[0]}")/../gate.js" "$@" --gate=G4
