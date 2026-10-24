#!/usr/bin/env bash
# Auxiliary Prism mock server, NOT G0 evidence or approval.
# Usage: bash g0-mock-server.sh --spec=path/to/openapi.yaml --port=4010
# Requires an already installed prism executable on PATH; never installs tools.
set -euo pipefail

SPEC_FILE=''
PORT=''
for arg in "$@"; do
  case "$arg" in
    --spec=*)
      if [[ -n "$SPEC_FILE" || -z "${arg#--spec=}" ]]; then
        printf '%s\n' 'BLOCKED: --spec must be supplied exactly once with a nonempty value.' >&2
        exit 1
      fi
      SPEC_FILE="${arg#--spec=}"
      ;;
    --port=*)
      if [[ -n "$PORT" || -z "${arg#--port=}" ]]; then
        printf '%s\n' 'BLOCKED: --port must be supplied exactly once with a nonempty value.' >&2
        exit 1
      fi
      PORT="${arg#--port=}"
      ;;
    *)
      printf '%s\n' 'BLOCKED: expected only --spec=... and --port=... .' >&2
      exit 1
      ;;
  esac
done

if [[ -z "$SPEC_FILE" || ! -f "$SPEC_FILE" ]]; then
  printf '%s\n' 'BLOCKED: --spec must name an existing specification file.' >&2
  exit 1
fi
if [[ ! "$PORT" =~ ^[1-9][0-9]{0,4}$ ]] || (( PORT > 65535 )); then
  printf '%s\n' 'BLOCKED: --port must be an integer from 1 to 65535.' >&2
  exit 1
fi
if ! command -v prism >/dev/null 2>&1; then
  printf '%s\n' 'BLOCKED: install Prism separately and expose prism on PATH.' >&2
  exit 1
fi

# Prefix relative paths so a filename beginning with '-' cannot become an option.
[[ "$SPEC_FILE" = /* ]] || SPEC_FILE="$PWD/$SPEC_FILE"
exec prism mock "$SPEC_FILE" --host=127.0.0.1 --port="$PORT"
