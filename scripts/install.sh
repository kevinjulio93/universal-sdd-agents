#!/usr/bin/env bash
# ==============================================================================
# UNIVERSAL SDD AGENTS - INSTALADOR MULTI-HARNESS
# ==============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-all}"
MODE="${2:-symlink}"

echo "🚀 Iniciando instalación de Universal SDD Agents..."
echo "📂 Repositorio: $REPO_DIR"
echo "🎯 Target: $TARGET | Modo: $MODE"

# 1. Ejecutar sincronizador de plantillas
node "$REPO_DIR/scripts/sync.js"

# 2. Despliegue según Target
case "$TARGET" in
  antigravity)
    echo "📦 Instalando para Google Antigravity..."
    mkdir -p "$HOME/.agents"
    if [ "$MODE" = "symlink" ]; then
      ln -sfn "$REPO_DIR/core/agents" "$HOME/.agents/agents"
      ln -sfn "$REPO_DIR/core/rules" "$HOME/.agents/rules"
      ln -sfn "$REPO_DIR/core/skills" "$HOME/.agents/skills"
      ln -sfn "$REPO_DIR/adapters/antigravity/mcp_config.json" "$HOME/.agents/mcp_config.json"
    else
      cp -r "$REPO_DIR/core/agents" "$HOME/.agents/"
      cp -r "$REPO_DIR/core/rules" "$HOME/.agents/"
      cp -r "$REPO_DIR/core/skills" "$HOME/.agents/"
      cp "$REPO_DIR/adapters/antigravity/mcp_config.json" "$HOME/.agents/mcp_config.json"
    fi
    echo "✅ Antigravity instalado correctamente en ~/.agents"
    ;;

  cursor)
    echo "📦 Exportando configuración para Cursor..."
    mkdir -p "./.cursor/rules"
    cp "$REPO_DIR/adapters/cursor/.cursorrules" "./.cursorrules"
    cp -r "$REPO_DIR/adapters/cursor/rules/"* "./.cursor/rules/"
    cp "$REPO_DIR/adapters/cursor/mcp.json" "./.cursor/mcp.json"
    echo "✅ Configuración para Cursor desplegada en el proyecto actual (.cursor/)"
    ;;

  claude)
    echo "📦 Exportando configuración para Claude Code..."
    cp "$REPO_DIR/adapters/claude-code/CLAUDE.md" "./CLAUDE.md"
    echo "✅ CLAUDE.md generado en el directorio actual"
    ;;

  windsurf)
    echo "📦 Exportando configuración para Windsurf..."
    cp "$REPO_DIR/adapters/windsurf/.windsurfrules" "./.windsurfrules"
    echo "✅ .windsurfrules generado en el directorio actual"
    ;;

  all)
    echo "📦 Instalando para todos los harnesses compatibles..."
    "$0" antigravity "$MODE"
    "$0" cursor "$MODE"
    "$0" claude "$MODE"
    "$0" windsurf "$MODE"
    ;;

  *)
    echo "❌ Target no reconocido: $TARGET"
    echo "Uso: ./scripts/install.sh [antigravity|cursor|claude|windsurf|all] [symlink|copy]"
    exit 1
    ;;
esac

echo "🎉 Proceso de instalación finalizado."
