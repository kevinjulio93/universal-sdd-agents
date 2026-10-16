#!/usr/bin/env bash
# ==============================================================================
# GATE 0: Levantamiento de Servidor Mock Determinista (Stoplight Prism)
# Coste en tokens: $0
# ==============================================================================
set -euo pipefail

SPEC_FILE="${1:-spec/openapi.yaml}"
PORT="${2:-4010}"

if [ ! -f "$SPEC_FILE" ]; then
  echo "❌ Error: Archivo de especificación no encontrado en $SPEC_FILE"
  exit 1
fi

echo "🚀 [Gate 0] Iniciando Prism Mock Server en http://127.0.0.1:$PORT..."
echo "ℹ️  El frontend y los evaluadores pueden interactuar inmediatamente con los mocks."
npx --yes @stoplight/prism-cli mock "$SPEC_FILE" -p "$PORT"
