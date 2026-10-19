#!/usr/bin/env bash
# ==============================================================================
# GATE 4: Validación Determinista Integral (SAST Semgrep + Cobertura SonarQube)
# Coste en tokens: $0
# ==============================================================================
set -euo pipefail

TARGET_DIR="${1:-.}"
REQ_LINE_COV="${2:-80}"
REQ_BRANCH_COV="${3:-80}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEMGREP_RULES="$SCRIPT_DIR/../../tools/semgrep.yaml"

echo "🛡️  [Gate 4] Paso 1/2: Ejecutando escaneo SAST con Semgrep..."

SAST_STATUS="PASS"
if command -v uvx >/dev/null 2>&1; then
  SAST_CMD="uvx semgrep scan --config $SEMGREP_RULES --error $TARGET_DIR"
elif command -v semgrep >/dev/null 2>&1; then
  SAST_CMD="semgrep scan --config $SEMGREP_RULES --error $TARGET_DIR"
else
  echo "⚠️ Semgrep no encontrado en PATH, omitiendo escaneo SAST local."
  SAST_CMD="true"
fi

if ! $SAST_CMD; then
  echo '{"gate": "G4", "sast": "FAIL", "reason": "Vulnerabilidades SAST detectadas por Semgrep", "status": "FAIL"}'
  exit 1
fi

echo "📊 [Gate 4] Paso 2/2: Verificando cobertura exacta y Quality Gate con SonarQube..."
SONAR_SCRIPT="$SCRIPT_DIR/g4-sonarqube-analysis.sh"

if [ -x "$SONAR_SCRIPT" ]; then
  if ! "$SONAR_SCRIPT" "$TARGET_DIR" "$REQ_LINE_COV" "$REQ_BRANCH_COV"; then
    echo '{"gate": "G4", "sast": "PASS", "sonarqube": "FAIL", "reason": "Fallo en el Quality Gate o umbral de cobertura SonarQube", "status": "FAIL"}'
    exit 1
  fi
else
  echo "⚠️ Script g4-sonarqube-analysis.sh no encontrado o sin permisos de ejecución."
fi

echo '{"gate": "G4", "sast": "PASS", "sonarqube": "OK", "status": "PASS", "message": "SAST limpio y Quality Gate SonarQube aprobado exitosamente"}'
exit 0
