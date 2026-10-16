#!/usr/bin/env node
/**
 * ==============================================================================
 * UNIVERSAL SDD AGENTS - INTERACTIVE CLI & SCAFFOLDER
 * ==============================================================================
 * CLI interactivo sin dependencias externas para desplegar y reconfigurar
 * el ecosistema SDD Multi-Harness (Globalmente en tu Mac o por Proyecto).
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORE_DIR = path.join(REPO_ROOT, 'core');
const ADAPTERS_DIR = path.join(REPO_ROOT, 'adapters');
const STACKS_DIR = path.join(CORE_DIR, 'stacks');
const HOME = process.env.HOME || '';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

const SCOPES = [
  { id: 'global', name: '🌍 Global (Disponible en TODA tu máquina para cualquier proyecto que abras)' },
  { id: 'project', name: '📁 Proyecto Actual (Solo para la carpeta actual donde ejecutas el comando)' }
];

const HARNESSES = [
  { id: 'antigravity', name: 'Google Antigravity (Nativo en ~/.agents y plugins)' },
  { id: 'cursor', name: 'Cursor IDE (.cursorrules, .cursor/rules/*.mdc, mcp.json)' },
  { id: 'claude', name: 'Claude Code (CLAUDE.md modular)' },
  { id: 'windsurf', name: 'Windsurf / Cascade (.windsurfrules)' },
  { id: 'all', name: 'Todos los anteriores (Full Ecosystem)' }
];

const STACKS = [
  { id: 'typescript', name: 'TypeScript / Node.js (Vitest, Biome/ESLint, tsc)', file: 'typescript/guidelines.md' },
  { id: 'python', name: 'Python (Pytest, Ruff, Mypy, FastAPI/Django)', file: 'python/guidelines.md' },
  { id: 'go', name: 'Go (go test, golangci-lint, Gin/Fiber)', file: 'go/guidelines.md' },
  { id: 'java', name: 'Java / Kotlin (JUnit 5, Maven/Gradle, Spring Boot)', file: 'java/guidelines.md' },
  { id: 'agnostic', name: 'Agnóstico / Políglota (Sin stack predeterminado)', file: null }
];

async function main() {
  console.clear();
  console.log('================================================================');
  console.log(' 🚀 UNIVERSAL SDD AGENTS - CLI & SCAFFOLDER (v1.1.0)');
  console.log(' Spec-Driven Development | Quality Gates G0-G5 | Multi-Harness');
  console.log('================================================================\n');

  // 1. Preguntar Scope (¿Global o Proyecto?)
  console.log('🌐 ¿Dónde deseas instalar o actualizar los agentes?');
  SCOPES.forEach((s, index) => {
    console.log(`  [${index + 1}] ${s.name}`);
  });
  const scopeChoice = await ask('\n👉 Elige el alcance [1-2] (default: 1): ') || '1';
  const selectedScope = SCOPES[parseInt(scopeChoice, 10) - 1] || SCOPES[0];

  // 2. Selección de Harness
  console.log('\n🎯 Selecciona el Harness de IA:');
  HARNESSES.forEach((h, index) => {
    console.log(`  [${index + 1}] ${h.name}`);
  });
  const harnessChoice = await ask('\n👉 Elige un harness [1-5] (default: 1): ') || '1';
  const selectedHarness = HARNESSES[parseInt(harnessChoice, 10) - 1] || HARNESSES[0];

  // 3. Selección de Lenguaje / Stack
  console.log('\n💻 Selecciona el Lenguaje / Stack principal:');
  STACKS.forEach((s, index) => {
    console.log(`  [${index + 1}] ${s.name}`);
  });
  const stackChoice = await ask('\n👉 Elige un stack [1-5] (default: 1): ') || '1';
  const selectedStack = STACKS[parseInt(stackChoice, 10) - 1] || STACKS[0];

  console.log('\n⏳ Sincronizando y compilando plantillas deterministas...');

  // 4. Inyectar directivas de Stack si se eligió uno
  let stackSnippet = '';
  if (selectedStack.file) {
    const stackFilePath = path.join(STACKS_DIR, selectedStack.file);
    if (fs.existsSync(stackFilePath)) {
      stackSnippet = `\n\n## 🛠️ Stack Tecnológico Activo (${selectedStack.name})\n` + fs.readFileSync(stackFilePath, 'utf8');
    }
  }

  // 5. Correr sincronizador base
  execSync(`node "${path.join(REPO_ROOT, 'scripts', 'sync.js')}"`, { stdio: 'inherit' });

  // Si hay stack seleccionado, enriquecer adaptadores
  if (stackSnippet) {
    console.log(`🔧 Personalizando directivas para stack: ${selectedStack.name}...`);
    ['claude-code/CLAUDE.md', 'cursor/.cursorrules', 'windsurf/.windsurfrules'].forEach(relPath => {
      const target = path.join(ADAPTERS_DIR, relPath);
      if (fs.existsSync(target)) {
        fs.appendFileSync(target, stackSnippet);
      }
    });
  }

  // 6. Despliegue según Scope (Global vs Proyecto)
  const isGlobal = selectedScope.id === 'global';
  const targetDir = isGlobal ? HOME : process.cwd();

  console.log(`\n🚀 Desplegando (${isGlobal ? 'MODO GLOBAL 🌍' : 'MODO PROYECTO 📁'} en ${targetDir})...`);

  function deployTarget(harnessId) {
    if (harnessId === 'antigravity') {
      // Antigravity SIEMPRE es global en ~/.agents
      const agentsDest = path.join(HOME, '.agents');
      fs.mkdirSync(agentsDest, { recursive: true });
      fs.cpSync(path.join(REPO_ROOT, 'core', 'agents'), path.join(agentsDest, 'agents'), { recursive: true });
      fs.cpSync(path.join(REPO_ROOT, 'core', 'rules'), path.join(agentsDest, 'rules'), { recursive: true });
      fs.cpSync(path.join(REPO_ROOT, 'core', 'skills'), path.join(agentsDest, 'skills'), { recursive: true });
      fs.copyFileSync(path.join(ADAPTERS_DIR, 'antigravity', 'mcp_config.json'), path.join(agentsDest, 'mcp_config.json'));
      console.log(`  ✅ [Antigravity] Agentes, reglas y MCPs instalados globalmente en ${agentsDest}`);
    }

    if (harnessId === 'cursor') {
      if (isGlobal) {
        // Global para Cursor en macOS (~/.cursor/rules)
        const globalCursorRules = path.join(HOME, '.cursor', 'rules');
        fs.mkdirSync(globalCursorRules, { recursive: true });
        fs.cpSync(path.join(ADAPTERS_DIR, 'cursor', 'rules'), globalCursorRules, { recursive: true });
        fs.copyFileSync(path.join(ADAPTERS_DIR, 'cursor', '.cursorrules'), path.join(HOME, '.cursorrules'));
        console.log(`  ✅ [Cursor Global] Reglas y Quality Gates instalados en ${HOME}/.cursor/rules/ y ~/.cursorrules`);
        console.log(`     👉 Todos los proyectos que abras en Cursor tendrán acceso a estos agentes.`);
      } else {
        // Local para el proyecto
        const localCursorRules = path.join(process.cwd(), '.cursor', 'rules');
        fs.mkdirSync(localCursorRules, { recursive: true });
        fs.cpSync(path.join(ADAPTERS_DIR, 'cursor', 'rules'), localCursorRules, { recursive: true });
        fs.copyFileSync(path.join(ADAPTERS_DIR, 'cursor', '.cursorrules'), path.join(process.cwd(), '.cursorrules'));
        fs.copyFileSync(path.join(ADAPTERS_DIR, 'cursor', 'mcp.json'), path.join(process.cwd(), '.cursor', 'mcp.json'));
        console.log(`  ✅ [Cursor Local] Configuración guardada en ${process.cwd()}/.cursor/`);
      }
    }

    if (harnessId === 'claude') {
      const dest = isGlobal ? path.join(HOME, 'CLAUDE.md') : path.join(process.cwd(), 'CLAUDE.md');
      fs.copyFileSync(path.join(ADAPTERS_DIR, 'claude-code', 'CLAUDE.md'), dest);
      console.log(`  ✅ [Claude Code] ${isGlobal ? 'CLAUDE.md global en ~/' : 'CLAUDE.md creado en el proyecto actual'}`);
    }

    if (harnessId === 'windsurf') {
      const dest = isGlobal ? path.join(HOME, '.windsurfrules') : path.join(process.cwd(), '.windsurfrules');
      fs.copyFileSync(path.join(ADAPTERS_DIR, 'windsurf', '.windsurfrules'), dest);
      console.log(`  ✅ [Windsurf] ${isGlobal ? '.windsurfrules global en ~/' : '.windsurfrules creado en el proyecto actual'}`);
    }
  }

  if (selectedHarness.id === 'all') {
    ['antigravity', 'cursor', 'claude', 'windsurf'].forEach(deployTarget);
  } else {
    deployTarget(selectedHarness.id);
  }

  console.log('\n================================================================');
  console.log(' 🎉 ¡Instalación finalizada con éxito!');
  console.log(` 📌 Alcance: ${selectedScope.name}`);
  console.log(` 📌 Harness: ${selectedHarness.name}`);
  console.log(` 📌 Stack:   ${selectedStack.name}`);
  console.log('================================================================\n');

  rl.close();
}

main().catch(err => {
  console.error('❌ Error en el CLI:', err);
  rl.close();
  process.exit(1);
});
