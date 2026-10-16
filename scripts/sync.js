#!/usr/bin/env node
/**
 * ==============================================================================
 * UNIVERSAL SDD AGENTS - SYNCHRONIZER & COMPILER
 * ==============================================================================
 * Compila la fuente única de verdad (core/) hacia las configuraciones nativas
 * de cada harness de IA sin duplicación manual y con coste $0 de tokens.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORE_DIR = path.join(REPO_ROOT, 'core');
const ADAPTERS_DIR = path.join(REPO_ROOT, 'adapters');
const MCP_TEMPLATE = path.join(REPO_ROOT, 'mcp', 'mcp_config.template.json');

// Cargar variables de entorno desde .env si existe
const envPath = path.join(REPO_ROOT, '.env');
const envVars = { ...process.env };

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...values] = trimmed.split('=');
      if (key) {
        envVars[key.trim()] = values.join('=').trim();
      }
    }
  });
}

function interpolateTemplate(templateStr) {
  return templateStr.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (match, varName) => {
    return envVars[varName] || match;
  });
}

// 1. Generar MCP Config
console.log('🔄 Compilando configuraciones MCP...');
if (fs.existsSync(MCP_TEMPLATE)) {
  const templateRaw = fs.readFileSync(MCP_TEMPLATE, 'utf8');
  const interpolated = interpolateTemplate(templateRaw);
  
  // Guardar en adapters/antigravity/mcp_config.json
  fs.writeFileSync(path.join(ADAPTERS_DIR, 'antigravity', 'mcp_config.json'), interpolated);
  // Guardar en adapters/cursor/mcp.json
  fs.writeFileSync(path.join(ADAPTERS_DIR, 'cursor', 'mcp.json'), interpolated);
}

// 2. Compilar reglas para Claude Code (CLAUDE.md)
console.log('🔄 Compilando CLAUDE.md para Claude Code...');
const agentsMdPath = path.join(CORE_DIR, 'rules', 'AGENTS.md');
if (fs.existsSync(agentsMdPath)) {
  const agentsRule = fs.readFileSync(agentsMdPath, 'utf8');
  const claudeMdContent = `# SPEC-DRIVEN DEVELOPMENT (SDD) - MULTIAGENT ENGINE\n\n` +
    `Este proyecto opera bajo **Spec-Driven Development** gobernado por **Quality Gates (G0-G5)**.\n` +
    `**Regla de Oro:** Deterministic First, LLM Last. Antes de evaluar subjetivamente, corre los scripts en \`scripts/gates/\`.\n\n` +
    agentsRule;
  fs.writeFileSync(path.join(ADAPTERS_DIR, 'claude-code', 'CLAUDE.md'), claudeMdContent);
}

// 3. Compilar reglas para Cursor (.cursorrules y .cursor/rules/)
console.log('🔄 Compilando reglas para Cursor...');
if (fs.existsSync(agentsMdPath)) {
  const agentsRule = fs.readFileSync(agentsMdPath, 'utf8');
  fs.writeFileSync(path.join(ADAPTERS_DIR, 'cursor', '.cursorrules'), agentsRule);
  
  const cursorRulesDir = path.join(ADAPTERS_DIR, 'cursor', 'rules');
  if (!fs.existsSync(cursorRulesDir)) {
    fs.mkdirSync(cursorRulesDir, { recursive: true });
  }
  
  // Rule MDC para Quality Gates
  const mdcContent = `---\ndescription: Reglas y Quality Gates SDD (G0 a G5)\nglobs: *\n---\n\n` + agentsRule;
  fs.writeFileSync(path.join(cursorRulesDir, '00-quality-gates.mdc'), mdcContent);
}

// 4. Compilar para Windsurf (.windsurfrules)
console.log('🔄 Compilando .windsurfrules para Windsurf...');
if (fs.existsSync(agentsMdPath)) {
  const agentsRule = fs.readFileSync(agentsMdPath, 'utf8');
  fs.writeFileSync(path.join(ADAPTERS_DIR, 'windsurf', '.windsurfrules'), agentsRule);
}

console.log('✅ Sincronización y compilación completada con éxito.');
