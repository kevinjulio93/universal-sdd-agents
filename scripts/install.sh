#!/usr/bin/env bash
# Thin entry point for the shared, preservation-aware deployer.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  printf '%s\n' \
    'Usage: bash scripts/install.sh [--target=DIR] [--harnesses=LIST] [--global=true|false]' \
    'LIST: opencode,claude,cursor,windsurf,antigravity or all (default: opencode).' \
    'Default target: current directory; with --global=true: home directory.' \
    'DIR must exist and must not be the SDD source tree. Quote paths with spaces.' \
    'Resources: DIR/.sdd (project) or DIR/.sdd/global (global).' \
    'Existing configurations are preserved; review returned integration notes.' \
    'Example: bash scripts/install.sh --target="/path/to/project" --harnesses=all --global=false'
  exit 0
fi

exec node "$REPO_DIR/scripts/deploy.js" "$@"
