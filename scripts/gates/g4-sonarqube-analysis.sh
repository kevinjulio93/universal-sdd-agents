#!/usr/bin/env bash
# Auxiliary Sonar check, NOT a complete G4 gate or release approval.
# Configure as a JSON check command under gate.js (which supplies SDD_* context).
# Usage: bash g4-sonarqube-analysis.sh --project=... [--branch=...|--pull-request=...] [--scanner=...]
# Delegates fresh analysis only; no stale local reports or invented coverage.
# Coverage, hotspots and duplication require separate configured checks.
set -euo pipefail
exec node "$(dirname "${BASH_SOURCE[0]}")/../sonar-check.js" "$@"
