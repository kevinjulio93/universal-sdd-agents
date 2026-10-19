#!/usr/bin/env bash
# ==============================================================================
# GATE 1: Verificación Estática Determinista (tsc, Biome, Ruff o Linter nativo)
# Coste en tokens: $0
# ==============================================================================
set -euo pipefail

TARGET_DIR="${1:-.}"

echo "🔍 [Gate 1] Ejecutando verificación estática determinista..."

# TypeScript Typecheck
if [ -f "$TARGET_DIR/tsconfig.json" ]; then
  echo "📘 Verificando tipos TypeScript (tsc --noEmit)..."
  if ! npx tsc --noEmit; then
    echo '{"gate": "G1", "status": "FAIL", "check": "tsc", "message": "Errores de tipos detectados"}'
    exit 1
  fi
fi

# Biome o Linter de Node
if [ -f "$TARGET_DIR/biome.json" ] || [ -f "$TARGET_DIR/biome.jsonc" ]; then
  echo "🧹 Ejecutando Biome lint..."
  if ! npx @biomejs/biome check "$TARGET_DIR"; then
    echo '{"gate": "G1", "status": "FAIL", "check": "biome", "message": "Errores de formato/linter detectados"}'
    exit 1
  fi
fi

# Python Ruff
if [ -f "$TARGET_DIR/pyproject.toml" ] || [ -f "$TARGET_DIR/requirements.txt" ]; then
  if command -v ruff >/dev/null 2>&1; then
    echo "🐍 Ejecutando Ruff check..."
    if ! ruff check "$TARGET_DIR"; then
      echo '{"gate": "G1", "status": "FAIL", "check": "ruff", "message": "Errores de linter Python detectados"}'
      exit 1
    fi
  fi
fi

echo '{"gate": "G1", "status": "PASS", "message": "Verificación estática aprobada con 0 errores"}'
exit 0
