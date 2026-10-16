#!/usr/bin/env node
/**
 * ==============================================================================
 * UNIVERSAL SDD AGENTS - INTERACTIVE CLI & SCAFFOLDER
 * ==============================================================================
 * CLI interactivo sin dependencias externas para desplegar y reconfigurar
 * el ecosistema SDD Multi-Harness y adaptar los agentes según el lenguaje/stack.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORE_DIR = path.join(REPO_ROOT, 'core');
const ADAPTERS_DIR = path.join(REPO_ROOT, 'adapters');
const STACKS_DIR = path.join(CORE_DIR, 'stacks');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

const HARNESSES = [
  { id: 'antigravity', name: 'Google Antigravity (Plugin nativo ~/.agents)', path: path.join(process.env.HOME || '', '.agents') },
  { id: 'cursor', name: 'Cursor IDE (.cursor/rules/*.mdc, .cursorrules, mcp.json)', path: './.cursor' },
  { id: 'claude', name: 'Claude Code (CLAUDE.md modular)', path: './CLAUDE.md' },
  { id: 'windsurf', name: 'Windsurf / Cascade (.windsurfrules)', path: './.windsurfrules' },
  { id: 'all', name: 'Todos los anteriores (Full Ecosystem)', path: 'Global + Proyecto' }
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
  console.log(' 🚀 UNIVERSAL SDD AGENTS - CLI & SCAFFOLDER (v1.0.0)');
  console.log(' Spec-Driven Development | Quality Gates G0-G5 | Multi-Harness');
  console.log('================================================================\n');

  // 1. Selección de Harness
  console.log('🎯 Selecciona el Harness de IA que deseas configurar o añadir:');
  HARNESSES.forEach((h, index) => {
    console.log(`  [${index + 1}] ${h.name}`);
  });
  const harnessChoice = await ask('\n👉 Elige una opción [1-5] (default: 1): ') || '1';
  const selectedHarness = HARNESSES[parseInt(harnessChoice, 10) - 1] || HARNESSES[0];

  // 2. Selección de Lenguaje / Stack
  console.log('\n💻 Selecciona el Lenguaje / Stack principal de tu proyecto:');
  STACKS.forEach((s, index) => {
    console.log(`  [${index + 1}] ${s.name}`);
  });
  const stackChoice = await ask('\n👉 Elige una opción [1-5] (default: 1): ') || '1';
  const selectedStack = STACKS[parseInt(stackChoice, 10) - 1] || STACKS[0];

  // 3. Selección de Modo de Instalación (si aplica)
  let installMode = 'symlink';
  if (selectedHarness.id === 'antigravity' || selectedHarness.id === 'all') {
    console.log('\n⚙️  Modo de instalación para Antigravity:');
    console.log('  [1] Symlink (Recomendado: cambios en este repo se reflejan al instante)');
    console.log('  [2] Standalone Copy (Copia estática independiente)');
    const modeChoice = await ask('\n👉 Elige una opción [1-2] (default: 1): ') || '1';
    installMode = modeChoice === '2' ? 'copy' : 'symlink';
  }

  console.log('\n⏳ Aplicando configuraciones deterministas...');

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

  // Si hay stack seleccionado, enriquecer reglas generadas
  if (stackSnippet) {
    console.log(`🔧 Personalizando directivas para stack: ${selectedStack.name}...`);
    // Enriquecer adapters/claude-code/CLAUDE.md
    const claudePath = path.join(ADAPTERS_DIR, 'claude-code', 'CLAUDE.md');
    if (fs.existsSync(claudePath)) {
      fs.appendFileSync(claudePath, stackSnippet);
    }
    // Enriquecer adapters/cursor/.cursorrules
    const cursorRulesPath = path.join(ADAPTERS_DIR, 'cursor', '.cursorrules');
    if (fs.existsSync(cursorRulesPath)) {
      fs.appendFileSync(cursorRulesPath, stackSnippet);
    }
    // Enriquecer adapters/windsurf/.windsurfrules
    const windsurfPath = path.join(ADAPTERS_DIR, 'windsurf', '.windsurfrules');
    if (fs.existsSync(windsurfPath)) {
      fs.appendFileSync(windsurfPath, stackSnippet);
    }
  }

  // 6. Ejecutar script de instalación para el target
  console.log(`\n🚀 Desplegando agentes para ${selectedHarness.name}...`);
  execSync(`"${path.join(REPO_ROOT, 'scripts', 'install.sh')}" "${selectedHarness.id}" "${installMode}"`, { stdio: 'inherit' });

  console.log('\n================================================================');
  console.log(' ✅ ¡Configuración completada con éxito!');
  console.log(` 📌 Harness configurado: ${selectedHarness.name}`);
  console.log(` 📌 Stack especializado: ${selectedStack.name}`);
  console.log(' 💡 Puedes volver a ejecutar `npm run start` o `sdd` en cualquier momento');
  console.log('    para añadir otro harness o cambiar de stack.');
  console.log('================================================================\n');

  rl.close();
}

main().catch(err => {
  console.error('❌ Error en el CLI:', err);
  rl.close();
  process.exit(1);
});
