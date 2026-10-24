#!/usr/bin/env bash
# G2 evidence runner. Usage: bash g2-contract-test.sh --run=... --phase=before|after --config=...
set -euo pipefail
exec node "$(dirname "${BASH_SOURCE[0]}")/../gate.js" "$@" --gate=G2
