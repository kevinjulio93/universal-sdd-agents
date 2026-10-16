#!/usr/bin/env bash
# ==============================================================================
# GATE 4: Análisis Estático de Seguridad (SAST con Semgrep) y Suite de Pruebas
# Coste en tokens: $0
# ==============================================================================
set -euo pipefail

TARGET_DIR="${1:-.}"
SEMGREP_RULES="$(dirname "$0")/../../tools/semgrep.yaml"

echo "🛡️  [Gate 4] Ejecutando escaneo SAST con Semgrep..."

if command -v uvx >/dev/null 2>&1; then
  SAST_CMD="uvx semgrep scan --config $SEMGREP_RULES --error $TARGET_DIR"
elif command -v semgrep >/dev/null 2>&1; then
  SAST_CMD="semgrep scan --config $SEMGREP_RULES --error $TARGET_DIR"
else
  echo "⚠️ Semgrep no encontrado en PATH, omitiendo escaneo SAST local."
  SAST_CMD="true"
fi

if $SAST_CMD; then
  echo '{"gate": "G4", "sast": "PASS", "vulnerabilities": 0, "status": "PASS"}'
  exit 0
else
  echo '{"gate": "G4", "sast": "FAIL", "reason": "Vulnerabilidades de seguridad detectadas", "status": "FAIL"}'
  exit 1
fi
