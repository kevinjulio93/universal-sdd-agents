#!/usr/bin/env bash
# G3 evidence runner. Usage: bash g3-integration-test.sh --run=... --phase=before|after --config=...
set -euo pipefail
exec node "$(dirname "${BASH_SOURCE[0]}")/../gate.js" "$@" --gate=G3
