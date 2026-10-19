#!/usr/bin/env bash
# ==============================================================================
# GATE 4: Análisis de Cobertura Exacta y Quality Gate con SonarQube
# Soporta: sonar-scanner + SonarQube API, y motor determinista de cobertura local
# Métricas: Line Coverage, Branch Coverage, Combined Coverage, Quality Gate Status
# Coste en tokens: $0
# ==============================================================================
set -euo pipefail

TARGET_DIR="${1:-.}"
REQ_LINE_COV="${2:-80}"
REQ_BRANCH_COV="${3:-80}"
PROPERTIES_TEMPLATE="$(dirname "$0")/../../tools/sonar-project.properties"

echo "📊 [Gate 4: SonarQube] Iniciando análisis de cobertura exacta..."

# Función para analizar lcov.info determinísticamente (Node/TS/Go/C++)
analyze_lcov() {
  local lcov_file="$1"
  local lines_found=0
  local lines_hit=0
  local branches_found=0
  local branches_hit=0

  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ ^LF:([0-9]+) ]]; then
      lines_found=$((lines_found + ${BASH_REMATCH[1]}))
    elif [[ "$line" =~ ^LH:([0-9]+) ]]; then
      lines_hit=$((lines_hit + ${BASH_REMATCH[1]}))
    elif [[ "$line" =~ ^BRF:([0-9]+) ]]; then
      branches_found=$((branches_found + ${BASH_REMATCH[1]}))
    elif [[ "$line" =~ ^BRH:([0-9]+) ]]; then
      branches_hit=$((branches_hit + ${BASH_REMATCH[1]}))
    fi
  done < "$lcov_file"

  # Calcular porcentajes con awk
  awk -v lf="$lines_found" -v lh="$lines_hit" -v bf="$branches_found" -v bh="$branches_hit" \
      -v req_l="$REQ_LINE_COV" -v req_b="$REQ_BRANCH_COV" '
  BEGIN {
    line_cov = (lf > 0) ? (lh / lf) * 100 : 100.0;
    branch_cov = (bf > 0) ? (bh / bf) * 100 : 100.0;
    total_items = lf + bf;
    total_hit = lh + bh;
    combined_cov = (total_items > 0) ? (total_hit / total_items) * 100 : 100.0;
    uncovered_lines = lf - lh;
    uncovered_branches = bf - bh;

    passed = (line_cov >= req_l && branch_cov >= req_b);
    qg_status = passed ? "OK" : "ERROR";
    gate_decision = passed ? "PASS" : "FAIL";

    printf "{\n"
    printf "  \"gate\": \"G4\",\n"
    printf "  \"tool\": \"sonarqube\",\n"
    printf "  \"quality_gate\": \"%s\",\n", qg_status
    printf "  \"metrics\": {\n"
    printf "    \"line_coverage\": %.2f,\n", line_cov
    printf "    \"branch_coverage\": %.2f,\n", branch_cov
    printf "    \"combined_coverage\": %.2f,\n", combined_cov
    printf "    \"lines_found\": %d,\n", lf
    printf "    \"lines_hit\": %d,\n", lh
    printf "    \"uncovered_lines\": %d,\n", uncovered_lines
    printf "    \"branches_found\": %d,\n", bf
    printf "    \"branches_hit\": %d,\n", bh
    printf "    \"uncovered_branches\": %d,\n", uncovered_branches
    printf "    \"thresholds\": {\n"
    printf "      \"required_line_coverage\": %d,\n", req_l
    printf "      \"required_branch_coverage\": %d\n", req_b
    printf "    }\n"
    printf "  },\n"
    printf "  \"status\": \"%s\"\n", gate_decision
    printf "}\n"

    exit (passed ? 0 : 1)
  }'
}

# 1. Si existe un servidor SonarQube y sonar-scanner activo en el entorno
if command -v sonar-scanner >/dev/null 2>&1 && [ -n "${SONAR_HOST_URL:-}" ]; then
  echo "📡 [Gate 4: SonarQube] Ejecutando sonar-scanner remoto contra $SONAR_HOST_URL..."
  PROPS_ARG=""
  if [ -f "$TARGET_DIR/sonar-project.properties" ]; then
    PROPS_ARG="-Dproject.settings=$TARGET_DIR/sonar-project.properties"
  elif [ -f "$PROPERTIES_TEMPLATE" ]; then
    PROPS_ARG="-Dproject.settings=$PROPERTIES_TEMPLATE"
  fi

  if sonar-scanner -Dsonar.projectBaseDir="$TARGET_DIR" -Dsonar.qualitygate.wait=true $PROPS_ARG; then
    echo '{"gate": "G4", "tool": "sonarqube", "quality_gate": "OK", "status": "PASS", "message": "SonarQube Quality Gate Passed"}'
    exit 0
  else
    echo '{"gate": "G4", "tool": "sonarqube", "quality_gate": "ERROR", "status": "FAIL", "message": "SonarQube Quality Gate Failed"}'
    exit 1
  fi
fi

# 2. Motor determinista local de cobertura SonarQube a partir de artefactos de cobertura
LCOV_CANDIDATES=(
  "$TARGET_DIR/coverage/lcov.info"
  "$TARGET_DIR/coverage/coverage.lcov"
  "$TARGET_DIR/lcov.info"
  "coverage/lcov.info"
)

FOUND_LCOV=""
for f in "${LCOV_CANDIDATES[@]}"; do
  if [ -f "$f" ]; then
    FOUND_LCOV="$f"
    break
  fi
done

if [ -n "$FOUND_LCOV" ]; then
  echo "📑 [Gate 4: SonarQube] Analizando métricas de cobertura exacta desde $FOUND_LCOV..."
  analyze_lcov "$FOUND_LCOV"
  exit $?
fi

# 3. Comprobar si existe coverage-summary.json (Jest/Vitest/nyc)
SUMMARY_JSON="$TARGET_DIR/coverage/coverage-summary.json"
if [ -f "$SUMMARY_JSON" ] && command -v jq >/dev/null 2>&1; then
  echo "📑 [Gate 4: SonarQube] Analizando cobertura desde $SUMMARY_JSON..."
  LINE_PCT=$(jq -r '.total.lines.pct // 0' "$SUMMARY_JSON")
  BRANCH_PCT=$(jq -r '.total.branches.pct // 0' "$SUMMARY_JSON")

  awk -v lp="$LINE_PCT" -v bp="$BRANCH_PCT" -v rl="$REQ_LINE_COV" -v rb="$REQ_BRANCH_COV" '
  BEGIN {
    passed = (lp >= rl && bp >= rb);
    qg_status = passed ? "OK" : "ERROR";
    gate_decision = passed ? "PASS" : "FAIL";

    printf "{\n"
    printf "  \"gate\": \"G4\",\n"
    printf "  \"tool\": \"sonarqube-local\",\n"
    printf "  \"quality_gate\": \"%s\",\n", qg_status
    printf "  \"metrics\": {\n"
    printf "    \"line_coverage\": %.2f,\n", lp
    printf "    \"branch_coverage\": %.2f,\n", bp
    printf "    \"thresholds\": { \"required_line_coverage\": %d, \"required_branch_coverage\": %d }\n", rl, rb
    printf "  },\n"
    printf "  \"status\": \"%s\"\n", gate_decision
    printf "}\n"

    exit (passed ? 0 : 1)
  }'
  exit $?
fi

echo "⚠️ [Gate 4: SonarQube] No se encontró reporte de cobertura (lcov.info o coverage-summary.json)."
echo "Asegúrate de ejecutar la suite de pruebas con flag de cobertura (ej. 'npm test -- --coverage' o 'pytest --cov')."
echo '{"gate": "G4", "tool": "sonarqube", "quality_gate": "UNVERIFIED", "status": "FAIL", "reason": "Reporte de cobertura no encontrado"}'
exit 1
