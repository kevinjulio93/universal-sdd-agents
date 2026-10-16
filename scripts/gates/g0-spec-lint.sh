#!/usr/bin/env bash
# ==============================================================================
# GATE 0: Linter determinista de Especificación OpenAPI (Stoplight Spectral)
# Coste en tokens: $0
# ==============================================================================
set -euo pipefail

SPEC_FILE="${1:-spec/openapi.yaml}"
RULES_FILE="$(dirname "$0")/../../tools/spectral.yaml"

if [ ! -f "$SPEC_FILE" ]; then
  echo '{"gate": "G0", "status": "FAIL", "reason": "Especificación no encontrada en '"$SPEC_FILE"'"}'
  exit 1
fi

echo "🔍 [Gate 0] Ejecutando Spectral Linter sobre $SPEC_FILE..."
if npx --yes @stoplight/spectral-cli lint "$SPEC_FILE" --ruleset "$RULES_FILE" --quiet; then
  echo '{"gate": "G0", "status": "PASS", "file": "'"$SPEC_FILE"'", "message": "Spec sintácticamente válida y aprobada"}'
  exit 0
else
  echo '{"gate": "G0", "status": "FAIL", "file": "'"$SPEC_FILE"'", "message": "Errores de diseño detectados en la especificación"}'
  exit 1
fi
