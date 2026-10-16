#!/usr/bin/env bash
# ==============================================================================
# GATE 2: Pruebas de Contrato Deterministas (Schemathesis Property-Based Testing)
# Valida que el código no tenga 'Spec Drift' respecto a la especificación OpenAPI
# Coste en tokens: $0
# ==============================================================================
set -euo pipefail

SPEC_FILE="${1:-spec/openapi.yaml}"
BASE_URL="${2:-http://localhost:3000}"
MAX_EXAMPLES="${3:-30}"

echo "🧪 [Gate 2] Ejecutando Schemathesis contra $BASE_URL usando $SPEC_FILE..."

if command -v uvx >/dev/null 2>&1; then
  CMD="uvx schemathesis"
elif command -v schemathesis >/dev/null 2>&1; then
  CMD="schemathesis"
else
  echo '{"gate": "G2", "status": "FAIL", "reason": "Schemathesis no está instalado. Ejecuta scripts/setup-tooling.sh"}'
  exit 1
fi

if $CMD run "$SPEC_FILE" --base-url="$BASE_URL" --max-examples="$MAX_EXAMPLES" --checks all; then
  echo '{"gate": "G2", "status": "PASS", "message": "Zero Spec Drift. 100% de contratos validados exitosamente."}'
  exit 0
else
  echo '{"gate": "G2", "status": "FAIL", "message": "Discrepancia de contrato detectada entre el código y la especificación."}'
  exit 1
fi
