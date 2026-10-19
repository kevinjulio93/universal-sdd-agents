#!/usr/bin/env node
/**
 * ==============================================================================
 * UNIVERSAL SPEC-DRIVEN DEVELOPMENT (SDD) - TUI CLI & SCAFFOLDER
 * ==============================================================================
 * Interfaz interactiva de terminal (TUI) para configurar el flujo completo SDD,
 * desplegar agentes multi-harness, scripts deterministas de Quality Gates (G0-G5)
 * y aprovisionar/configurar SonarQube para auditoría de cobertura exacta.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const {
  intro,
  outro,
  select,
  multiselect,
  text,
  confirm,
  spinner,
  note,
  log,
  isCancel,
  cancel
} = require('@clack/prompts');
const pc = require('picocolors');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORE_DIR = path.join(REPO_ROOT, 'core');
const ADAPTERS_DIR = path.join(REPO_ROOT, 'adapters');
const STACKS_DIR = path.join(CORE_DIR, 'stacks');
const TOOLS_DIR = path.join(REPO_ROOT, 'tools');
const SCRIPTS_DIR = path.join(REPO_ROOT, 'scripts');
const HOME = process.env.HOME || '';

// Manejo seguro de cancelación en prompts
function checkCancel(val, message = 'Instalación cancelada por el usuario.') {
  if (isCancel(val)) {
    cancel(pc.yellow(message));
    process.exit(0);
  }
  return val;
}

// Helpers de utilidades del sistema
function hasCommand(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function checkSonarServer(url = 'http://localhost:9000') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const cleanUrl = url.replace(/\/$/, '');
    const res = await fetch(`${cleanUrl}/api/system/status`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      return { reachable: true, status: data.status, version: data.version, url: cleanUrl };
    }
  } catch (e) {
    // server unreachable
  }
  return { reachable: false, url };
}

function checkDockerSonarContainer() {
  if (!hasCommand('docker')) return null;
  try {
    const out = execSync('docker ps -a --filter "name=sonar" --format "{{.ID}}|{{.Names}}|{{.Status}}"', { encoding: 'utf8' }).trim();
    if (out) {
      const lines = out.split('\n');
      const [id, name, status] = lines[0].split('|');
      const isUp = status.toLowerCase().includes('up');
      return { id, name, running: isUp, status };
    }
  } catch {}
  return null;
}

// -----------------------------------------------------------------------------
// SUB-ROUTINE: Diagnóstico de Entorno (Doctor)
// -----------------------------------------------------------------------------
async function runDoctor() {
  const s = spinner();
  s.start('Ejecutando diagnóstico del sistema...');

  const checks = [];

  // Node & NPM
  checks.push({
    name: 'Node.js',
    ok: true,
    detail: process.version
  });

  // Docker
  const dockerOk = hasCommand('docker');
  checks.push({
    name: 'Docker CLI',
    ok: dockerOk,
    detail: dockerOk ? 'Instalado' : 'No encontrado (opcional para SonarQube local)'
  });

  // SonarQube Server
  const sonarStatus = await checkSonarServer();
  const sonarContainer = checkDockerSonarContainer();
  checks.push({
    name: 'SonarQube Server (http://localhost:9000)',
    ok: sonarStatus.reachable,
    detail: sonarStatus.reachable 
      ? `Activo (v${sonarStatus.version}, status: ${sonarStatus.status})` 
      : (sonarContainer ? `Contenedor ${sonarContainer.name} detenido (${sonarContainer.status})` : 'Inactivo / No detectado')
  });

  // Sonar-Scanner CLI
  const scannerOk = hasCommand('sonar-scanner');
  checks.push({
    name: 'SonarScanner CLI',
    ok: scannerOk,
    detail: scannerOk ? 'Instalado en PATH' : 'No instalado (el motor local usará fallback determinista)'
  });

  // Semgrep
  const semgrepOk = hasCommand('semgrep') || hasCommand('uvx');
  checks.push({
    name: 'Semgrep SAST (Gate 4)',
    ok: semgrepOk,
    detail: semgrepOk ? 'Disponible' : 'Instalar uv/uvx o semgrep para SAST nativo'
  });

  // Schemathesis
  const schemathesisOk = hasCommand('schemathesis') || hasCommand('uvx');
  checks.push({
    name: 'Schemathesis (Gate 2: Contract Test)',
    ok: schemathesisOk,
    detail: schemathesisOk ? 'Disponible' : 'Instalar schemathesis para contract testing'
  });

  s.stop('Diagnóstico completado');

  let report = '';
  checks.forEach(c => {
    const symbol = c.ok ? pc.green('✔') : pc.yellow('✖');
    report += `${symbol} ${pc.bold(c.name)}: ${c.detail}\n`;
  });

  note(report.trim(), 'Resultados del Diagnóstico');
}

// -----------------------------------------------------------------------------
// SUB-ROUTINE: Aprovisionamiento y Configuración de SonarQube
// -----------------------------------------------------------------------------
async function handleSonarQubeSetup(targetProjectDir, selectedStack) {
  log.step(pc.cyan('🔍 Comprobando estado de SonarQube...'));

  const liveServer = await checkSonarServer();
  const dockerContainer = checkDockerSonarContainer();

  let sonarConfig = {
    enabled: true,
    hostUrl: 'http://localhost:9000',
    projectKey: path.basename(targetProjectDir).toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
    projectName: path.basename(targetProjectDir),
    token: ''
  };

  if (liveServer.reachable) {
    log.success(pc.green(`✔ Servidor SonarQube activo en ${liveServer.url} (Versión: ${liveServer.version})`));
  } else if (dockerContainer) {
    log.warn(pc.yellow(`⚠ Contenedor de SonarQube encontrado (${dockerContainer.name}), pero su estado es: ${dockerContainer.status}`));
    
    const startIt = checkCancel(await confirm({
      message: `¿Deseas iniciar el contenedor '${dockerContainer.name}' ahora?`,
      initialValue: true
    }));

    if (startIt) {
      const s = spinner();
      s.start(`Iniciando contenedor ${dockerContainer.name}...`);
      try {
        execSync(`docker start ${dockerContainer.name}`, { stdio: 'ignore' });
        s.stop(`Contenedor ${dockerContainer.name} iniciado`);
        log.info(pc.cyan('SonarQube estará listo en unos segundos en http://localhost:9000'));
      } catch (e) {
        s.stop(pc.red('Error iniciando contenedor'));
      }
    }
  } else {
    log.warn(pc.yellow('⚠ No se detectó ninguna instancia de SonarQube activa en http://localhost:9000.'));
    log.info(pc.dim('SonarQube es esencial en el Gate 4 y Gate 5 para auditar cobertura exacta de líneas y ramas (≥ 80%).'));

    const sonarqubeChoice = checkCancel(await select({
      message: '¿Cómo deseas aprovisionar o conectar SonarQube para este entorno?',
      options: [
        ...(hasCommand('docker') ? [
          {
            value: 'docker_run',
            label: '🐳 Iniciar SonarQube Community vía Docker automáticamente (Recomendado)',
            hint: 'Descarga e inicia sonarqube:community en puerto 9000'
          }
        ] : []),
        {
          value: 'docker_compose',
          label: '📄 Generar docker-compose.sonarqube.yml en el proyecto',
          hint: 'Podrás levantarlo cuando desees con docker compose up -d'
        },
        ...(hasCommand('brew') ? [
          {
            value: 'brew_scanner',
            label: '📦 Instalar SonarScanner CLI mediante Homebrew (brew install sonar-scanner)',
            hint: 'Instala la CLI nativa para macOS'
          }
        ] : []),
        {
          value: 'remote',
          label: '🌐 Conectar a un SonarQube remoto o SonarCloud existente',
          hint: 'Especificar URL remota y Token de autenticación'
        },
        {
          value: 'offline',
          label: '⚡ Usar motor determinista local de SDD ($0 Tokens / Sin Servidor)',
          hint: 'Calcula cobertura exacta de líneas y ramas desde reportes locales sin levantar SonarQube'
        }
      ]
    }));

    if (sonarqubeChoice === 'docker_run') {
      const s = spinner();
      s.start('Iniciando contenedor sonarqube:community en puerto 9000...');
      try {
        execSync('docker run -d --name sonarqube -p 9000:9000 sonarqube:community', { stdio: 'ignore' });
        s.stop(pc.green('Contenedor SonarQube creado y lanzado con éxito.'));
        log.info(pc.cyan('🌐 Accede a la interfaz web en: http://localhost:9000 (Credenciales por defecto: admin / admin)'));
      } catch (err) {
        s.stop(pc.red('No se pudo lanzar el contenedor automáticamente. Se creará docker-compose como fallback.'));
        fs.copyFileSync(
          path.join(TOOLS_DIR, 'docker-compose.sonarqube.yml'),
          path.join(targetProjectDir, 'docker-compose.sonarqube.yml')
        );
      }
    } else if (sonarqubeChoice === 'docker_compose') {
      const composeDest = path.join(targetProjectDir, 'docker-compose.sonarqube.yml');
      fs.copyFileSync(path.join(TOOLS_DIR, 'docker-compose.sonarqube.yml'), composeDest);
      log.success(pc.green(`✔ Plantilla generada en ${composeDest}. Ejecuta: docker compose -f docker-compose.sonarqube.yml up -d`));
    } else if (sonarqubeChoice === 'brew_scanner') {
      const s = spinner();
      s.start('Ejecutando: brew install sonar-scanner...');
      try {
        execSync('brew install sonar-scanner', { stdio: 'inherit' });
        s.stop(pc.green('SonarScanner CLI instalado correctamente.'));
      } catch (e) {
        s.stop(pc.red('Fallo en la instalación con brew.'));
      }
    } else if (sonarqubeChoice === 'remote') {
      const remoteUrl = checkCancel(await text({
        message: 'Ingresa la URL del servidor SonarQube:',
        initialValue: 'https://sonarcloud.io',
        validate: (v) => (!v.startsWith('http') ? 'Debe ser una URL válida (http/https)' : undefined)
      }));
      sonarConfig.hostUrl = remoteUrl;
    } else if (sonarqubeChoice === 'offline') {
      log.info(pc.cyan('✓ Motor local activado: scripts/gates/g4-sonarqube-analysis.sh auditará lcov.info y cobertura determinista.'));
    }
  }

  // Configuración de sonar-project.properties
  const wantProperties = checkCancel(await confirm({
    message: '¿Deseas configurar/actualizar el archivo sonar-project.properties para este proyecto?',
    initialValue: true
  }));

  if (wantProperties) {
    const pKey = checkCancel(await text({
      message: 'Project Key en SonarQube:',
      initialValue: sonarConfig.projectKey
    }));
    const pName = checkCancel(await text({
      message: 'Project Name en SonarQube:',
      initialValue: sonarConfig.projectName
    }));
    const token = checkCancel(await text({
      message: 'SonarQube Token de análisis (opcional, presiona Enter para omitir):',
      initialValue: ''
    }));

    sonarConfig.projectKey = pKey;
    sonarConfig.projectName = pName;
    sonarConfig.token = token;

    // Crear o actualizar sonar-project.properties a la medida del stack
    let propertiesContent = `# ==============================================================================\n` +
      `# SonarQube Configuration - Spec-Driven Development Standard\n` +
      `# ==============================================================================\n\n` +
      `sonar.projectKey=${pKey}\n` +
      `sonar.projectName=${pName}\n` +
      `sonar.projectVersion=1.0.0\n` +
      `sonar.sourceEncoding=UTF-8\n` +
      `sonar.host.url=${sonarConfig.hostUrl}\n`;

    if (token) {
      propertiesContent += `sonar.token=${token}\n`;
    }

    // Configuración específica de fuentes y cobertura según stack
    if (selectedStack.id === 'typescript') {
      propertiesContent += `\nsonar.sources=src,app,lib\n` +
        `sonar.tests=tests,test,__tests__,spec\n` +
        `sonar.javascript.lcov.reportPaths=coverage/lcov.info\n` +
        `sonar.typescript.lcov.reportPaths=coverage/lcov.info\n` +
        `sonar.coverage.exclusions=**/*.test.*,**/*.spec.*,**/node_modules/**,**/dist/**,**/build/**\n`;
    } else if (selectedStack.id === 'python') {
      propertiesContent += `\nsonar.sources=src,app\n` +
        `sonar.tests=tests,test\n` +
        `sonar.python.coverage.reportPaths=coverage.xml\n` +
        `sonar.coverage.exclusions=**/*test*.*,**/venv/**,**/__pycache__/**\n`;
    } else if (selectedStack.id === 'go') {
      propertiesContent += `\nsonar.sources=.\n` +
        `sonar.tests=.\n` +
        `sonar.test.inclusions=**/*_test.go\n` +
        `sonar.go.coverage.reportPaths=coverage.out\n` +
        `sonar.coverage.exclusions=**/*_test.go,**/vendor/**\n`;
    } else if (selectedStack.id === 'java') {
      propertiesContent += `\nsonar.sources=src/main\n` +
        `sonar.tests=src/test\n` +
        `sonar.coverageReportPaths=target/site/jacoco/jacoco.xml\n` +
        `sonar.coverage.exclusions=**/test/**,**/target/**\n`;
    } else {
      propertiesContent += `\nsonar.sources=.\n` +
        `sonar.coverage.exclusions=**/*.test.*,**/*.spec.*,**/node_modules/**,**/dist/**\n` +
        `sonar.javascript.lcov.reportPaths=coverage/lcov.info\n`;
    }

    propertiesContent += `\n# Quality Gate Enforcement\n` +
      `sonar.qualitygate.wait=true\n` +
      `sonar.qualitygate.timeout=300\n`;

    const propPath = path.join(targetProjectDir, 'sonar-project.properties');
    fs.writeFileSync(propPath, propertiesContent, 'utf8');
    log.success(pc.green(`✔ Archivo sonar-project.properties creado/actualizado en ${propPath}`));

    // Guardar SONAR_HOST_URL en .env del proyecto si no existe
    const envDest = path.join(targetProjectDir, '.env');
    if (fs.existsSync(envDest)) {
      const currentEnv = fs.readFileSync(envDest, 'utf8');
      let appendStr = '';
      if (!currentEnv.includes('SONAR_HOST_URL=')) {
        appendStr += `\nSONAR_HOST_URL=${sonarConfig.hostUrl}\n`;
      }
      if (token && !currentEnv.includes('SONAR_TOKEN=')) {
        appendStr += `SONAR_TOKEN=${token}\n`;
      }
      if (appendStr) {
        fs.appendFileSync(envDest, appendStr, 'utf8');
        log.info(pc.dim('✔ Variables de SonarQube registradas en .env'));
      }
    }
  }

  return sonarConfig;
}

// -----------------------------------------------------------------------------
// SUB-ROUTINE: Despliegue de Agentes y Adaptadores
// -----------------------------------------------------------------------------
function deployHarnesses(selectedHarnesses, isGlobal, targetDir, stackSnippet, selectedStack) {
  const isAll = selectedHarnesses.includes('all');

  function shouldDeploy(hId) {
    return isAll || selectedHarnesses.includes(hId);
  }

  // 1. Antigravity (Google Antigravity)
  if (shouldDeploy('antigravity')) {
    const agentsDest = path.join(HOME, '.agents');
    const geminiPluginsDest = path.join(HOME, '.gemini', 'config', 'plugins', 'engineering-team');

    fs.mkdirSync(agentsDest, { recursive: true });
    fs.cpSync(path.join(REPO_ROOT, 'core', 'agents'), path.join(agentsDest, 'agents'), { recursive: true });
    fs.cpSync(path.join(REPO_ROOT, 'core', 'rules'), path.join(agentsDest, 'rules'), { recursive: true });
    fs.cpSync(path.join(REPO_ROOT, 'core', 'skills'), path.join(agentsDest, 'skills'), { recursive: true });
    fs.cpSync(path.join(REPO_ROOT, 'scripts'), path.join(agentsDest, 'scripts'), { recursive: true });
    fs.cpSync(path.join(REPO_ROOT, 'tools'), path.join(agentsDest, 'tools'), { recursive: true });

    // Ensure executable permissions
    try {
      execSync(`chmod +x "${path.join(agentsDest, 'scripts', 'gates')}"/*.sh`, { stdio: 'ignore' });
    } catch {}

    const mcpConfigSrc = path.join(ADAPTERS_DIR, 'antigravity', 'mcp_config.json');
    if (fs.existsSync(mcpConfigSrc)) {
      fs.copyFileSync(mcpConfigSrc, path.join(agentsDest, 'mcp_config.json'));
    }
    const pluginJsonSrc = path.join(ADAPTERS_DIR, 'antigravity', 'plugin.json');
    if (fs.existsSync(pluginJsonSrc)) {
      fs.copyFileSync(pluginJsonSrc, path.join(agentsDest, 'plugin.json'));
    }

    // Registrar plugin nativo en ~/.gemini/config/plugins/engineering-team
    fs.mkdirSync(path.dirname(geminiPluginsDest), { recursive: true });
    try {
      if (fs.existsSync(geminiPluginsDest)) {
        fs.rmSync(geminiPluginsDest, { recursive: true, force: true });
      }
      fs.symlinkSync(agentsDest, geminiPluginsDest, 'dir');
    } catch (e) {
      fs.cpSync(agentsDest, geminiPluginsDest, { recursive: true });
    }

    log.success(pc.green(`✔ [Google Antigravity] Agentes desplegados en ~/.agents y registrados en ~/.gemini`));
  }

  // 2. Cursor IDE
  if (shouldDeploy('cursor')) {
    if (isGlobal) {
      const globalRulesDir = path.join(HOME, '.cursor', 'rules');
      fs.mkdirSync(globalRulesDir, { recursive: true });
      fs.cpSync(path.join(ADAPTERS_DIR, 'cursor', 'rules'), globalRulesDir, { recursive: true });
      fs.copyFileSync(path.join(ADAPTERS_DIR, 'cursor', '.cursorrules'), path.join(HOME, '.cursorrules'));
      log.success(pc.green(`✔ [Cursor Global] Reglas desplegadas en ~/.cursor/rules y ~/.cursorrules`));
    } else {
      const localRulesDir = path.join(targetDir, '.cursor', 'rules');
      fs.mkdirSync(localRulesDir, { recursive: true });
      fs.cpSync(path.join(ADAPTERS_DIR, 'cursor', 'rules'), localRulesDir, { recursive: true });
      fs.copyFileSync(path.join(ADAPTERS_DIR, 'cursor', '.cursorrules'), path.join(targetDir, '.cursorrules'));
      const mcpSrc = path.join(ADAPTERS_DIR, 'cursor', 'mcp.json');
      if (fs.existsSync(mcpSrc)) {
        fs.copyFileSync(mcpSrc, path.join(targetDir, '.cursor', 'mcp.json'));
      }
      log.success(pc.green(`✔ [Cursor Local] Configuración guardada en ${targetDir}/.cursor/`));
    }
  }

  // 3. Claude Code
  if (shouldDeploy('claude')) {
    const claudeDest = isGlobal ? path.join(HOME, 'CLAUDE.md') : path.join(targetDir, 'CLAUDE.md');
    fs.copyFileSync(path.join(ADAPTERS_DIR, 'claude-code', 'CLAUDE.md'), claudeDest);
    log.success(pc.green(`✔ [Claude Code] ${isGlobal ? 'CLAUDE.md global en ~/' : 'CLAUDE.md en proyecto'}`));
  }

  // 4. Windsurf / Cascade
  if (shouldDeploy('windsurf')) {
    const windsurfDest = isGlobal ? path.join(HOME, '.windsurfrules') : path.join(targetDir, '.windsurfrules');
    fs.copyFileSync(path.join(ADAPTERS_DIR, 'windsurf', '.windsurfrules'), windsurfDest);
    log.success(pc.green(`✔ [Windsurf] ${isGlobal ? '.windsurfrules global en ~/' : '.windsurfrules en proyecto'}`));
  }

  // 5. OpenCode
  if (shouldDeploy('opencode')) {
    const openCodeDest = isGlobal ? path.join(HOME, '.config', 'opencode', 'agents') : path.join(targetDir, '.opencode', 'agents');
    fs.mkdirSync(openCodeDest, { recursive: true });
    fs.cpSync(path.join(REPO_ROOT, 'core', 'agents'), openCodeDest, { recursive: true });
    log.success(pc.green(`✔ [OpenCode] 9 Agentes instalados en ${openCodeDest}`));
  }

  // Si se instala a nivel de proyecto, desplegar también scripts/gates/ y tools/ locales
  if (!isGlobal) {
    const localGatesDest = path.join(targetDir, 'scripts', 'gates');
    const localToolsDest = path.join(targetDir, 'tools');
    fs.mkdirSync(localGatesDest, { recursive: true });
    fs.mkdirSync(localToolsDest, { recursive: true });

    fs.cpSync(path.join(REPO_ROOT, 'scripts', 'gates'), localGatesDest, { recursive: true });
    fs.cpSync(path.join(REPO_ROOT, 'tools'), localToolsDest, { recursive: true });

    try {
      execSync(`chmod +x "${localGatesDest}"/*.sh`, { stdio: 'ignore' });
    } catch {}

    log.success(pc.green(`✔ [Scripts & Quality Gates] Scripts deterministas instalados en ./scripts/gates/`));
  }
}

// -----------------------------------------------------------------------------
// MAIN CONTROLLER
// -----------------------------------------------------------------------------
async function main() {
  console.clear();
  intro(pc.bgCyan(pc.black(' 🚀 UNIVERSAL SPEC-DRIVEN DEVELOPMENT (SDD) - TUI CLI ')));

  // Atajo directo si se pasa flag --doctor
  if (process.argv.includes('--doctor') || process.argv.includes('doctor')) {
    await runDoctor();
    outro(pc.green('Diagnóstico finalizado. Ejecuta "sdd" para iniciar el asistente interactivo.'));
    process.exit(0);
  }

  // Paso 1: Elegir Modo de Acción
  const action = checkCancel(await select({
    message: '¿Qué deseas hacer hoy?',
    options: [
      {
        value: 'full',
        label: '🚀 Instalación Completa del Flujo SDD (Recomendado)',
        hint: 'Despliega Agentes, Quality Gates G0-G5, Scripts deterministas y SonarQube'
      },
      {
        value: 'harness_only',
        label: '🤖 Desplegar o Actualizar solo Agentes y Adaptadores IA',
        hint: 'Actualiza Antigravity, Cursor, Claude Code, Windsurf u OpenCode'
      },
      {
        value: 'sonarqube_only',
        label: '📊 Configurar / Iniciar SonarQube y Quality Gates (G4/G5)',
        hint: 'Diagnostica, levanta contenedor Docker y configura sonar-project.properties'
      },
      {
        value: 'doctor',
        label: '🩺 Diagnóstico del Entorno (Doctor)',
        hint: 'Verifica estado de Docker, SonarQube, herramientas SAST y linters'
      }
    ]
  }));

  if (action === 'doctor') {
    await runDoctor();
    outro(pc.green('Diagnóstico finalizado. Ejecuta de nuevo para instalar o actualizar.'));
    process.exit(0);
  }

  // Paso 2: Scope / Alcance
  const scope = checkCancel(await select({
    message: '¿Dónde deseas aplicar la configuración?',
    options: [
      {
        value: 'project',
        label: '📁 Proyecto Actual (Recomendado para trabajo activo)',
        hint: process.cwd()
      },
      {
        value: 'global',
        label: '🌍 Global en tu Mac (~/ y ~/.agents)',
        hint: 'Disponible para cualquier proyecto que abras en tu máquina'
      }
    ]
  }));

  const isGlobal = scope === 'global';
  const targetDir = isGlobal ? HOME : process.cwd();

  // Si es solo SonarQube
  if (action === 'sonarqube_only') {
    await handleSonarQubeSetup(targetDir, { id: 'typescript', name: 'TypeScript / Node.js' });
    outro(pc.green('Configuración de SonarQube y Quality Gates completada con éxito.'));
    process.exit(0);
  }

  // Paso 3: Selección de Harnesses de IA
  const harnesses = checkCancel(await multiselect({
    message: 'Selecciona los Harnesses de IA que deseas aprovisionar:',
    options: [
      { value: 'all', label: '✨ Todos los Harnesses (Ecosistema Completo)' },
      { value: 'antigravity', label: 'Google Antigravity (~/.agents + plugin nativo)' },
      { value: 'cursor', label: 'Cursor IDE (.cursorrules, .cursor/rules/*.mdc, mcp.json)' },
      { value: 'claude', label: 'Claude Code (CLAUDE.md modular)' },
      { value: 'windsurf', label: 'Windsurf / Cascade (.windsurfrules)' },
      { value: 'opencode', label: 'OpenCode (~/.config/opencode/agents)' }
    ],
    initialValues: ['all'],
    required: true
  }));

  // Paso 4: Selección de Stack Tecnológico
  const stack = checkCancel(await select({
    message: 'Selecciona el Stack o Lenguaje principal de este entorno:',
    options: [
      { value: 'typescript', label: 'TypeScript / Node.js', hint: 'Vitest/Jest con LCOV, Biome, tsc' },
      { value: 'python', label: 'Python', hint: 'Pytest con Cobertura XML, Ruff, Mypy' },
      { value: 'go', label: 'Go', hint: 'go test con coverage.out, golangci-lint' },
      { value: 'java', label: 'Java / Spring Boot', hint: 'JUnit 5, JaCoCo XML, Maven/Gradle' },
      { value: 'agnostic', label: 'Agnóstico / Políglota', hint: 'Sin stack específico predefinido' }
    ]
  }));

  const STACK_MAP = {
    typescript: { id: 'typescript', name: 'TypeScript / Node.js', file: 'typescript/guidelines.md' },
    python: { id: 'python', name: 'Python', file: 'python/guidelines.md' },
    go: { id: 'go', name: 'Go', file: 'go/guidelines.md' },
    java: { id: 'java', name: 'Java / Spring Boot', file: 'java/guidelines.md' },
    agnostic: { id: 'agnostic', name: 'Agnóstico / Políglota', file: null }
  };
  const selectedStack = STACK_MAP[stack];

  // Paso 5: Configuración e Instalación de SonarQube
  let sonarConfig = null;
  if (action === 'full') {
    sonarConfig = await handleSonarQubeSetup(targetDir, selectedStack);
  }

  // Confirmación final antes de desplegar
  const proceed = checkCancel(await confirm({
    message: `¿Proceder con la instalación en ${isGlobal ? 'modo GLOBAL' : 'modo PROYECTO'}?`,
    initialValue: true
  }));

  if (!proceed) {
    cancel(pc.yellow('Instalación cancelada.'));
    process.exit(0);
  }

  // Ejecución con Spinners
  const s = spinner();
  s.start('Sincronizando reglas y compilando adaptadores multi-harness...');

  try {
    // 1. Ejecutar sync.js
    execSync(`node "${path.join(REPO_ROOT, 'scripts', 'sync.js')}"`, { stdio: 'ignore' });

    // 2. Extraer directivas de stack si aplica
    let stackSnippet = '';
    if (selectedStack.file) {
      const stackFilePath = path.join(STACKS_DIR, selectedStack.file);
      if (fs.existsSync(stackFilePath)) {
        stackSnippet = `\n\n## 🛠️ Stack Tecnológico Activo (${selectedStack.name})\n` + fs.readFileSync(stackFilePath, 'utf8');
      }
    }

    if (stackSnippet) {
      ['claude-code/CLAUDE.md', 'cursor/.cursorrules', 'windsurf/.windsurfrules'].forEach(relPath => {
        const target = path.join(ADAPTERS_DIR, relPath);
        if (fs.existsSync(target)) {
          fs.appendFileSync(target, stackSnippet);
        }
      });
    }

    s.message('Desplegando agentes, adaptadores y Quality Gates...');
    deployHarnesses(harnesses, isGlobal, targetDir, stackSnippet, selectedStack);

    s.stop(pc.green('¡Despliegue y compilación finalizados con éxito!'));
  } catch (err) {
    s.stop(pc.red('Ocurrió un error durante el despliegue.'));
    console.error(err);
    process.exit(1);
  }

  // Resumen Final
  const summary = [
    `${pc.bold('Alcance:')}     ${isGlobal ? '🌍 Global (~/.agents)' : '📁 Proyecto (' + targetDir + ')'}`,
    `${pc.bold('Harnesses:')}   ${harnesses.includes('all') ? 'Ecosistema Completo (Antigravity, Cursor, Claude, Windsurf, OpenCode)' : harnesses.join(', ')}`,
    `${pc.bold('Stack:')}       ${selectedStack.name}`,
    `${pc.bold('SonarQube:')}   ${sonarConfig ? (sonarConfig.hostUrl + ' (Project: ' + sonarConfig.projectKey + ')') : 'Offline Deterministic'}`,
    '',
    pc.bold('Comandos de Quality Gates deterministas ($0 Tokens):'),
    `  • ${pc.cyan('./scripts/gates/g0-spec-lint.sh')}         → Validar OpenAPI/Spec (Spectral)`,
    `  • ${pc.cyan('./scripts/gates/g1-static-check.sh')}       → Linter & Typecheck (tsc/biome)`,
    `  • ${pc.cyan('./scripts/gates/g2-contract-test.sh')}      → Contract Fuzzing (Schemathesis)`,
    `  • ${pc.cyan('./scripts/gates/g4-test-and-security.sh')}  → SAST + Cobertura SonarQube (≥ 80%)`,
    `  • ${pc.cyan('./scripts/gates/g5-metrics-summary.sh')}    → Reporte oficial de Release`
  ].join('\n');

  note(summary, 'Resumen de Instalación SDD');

  outro(pc.bgGreen(pc.black(' 🎉 ¡El ecosistema Spec-Driven Development está listo para operar! ')));
}

main().catch(err => {
  console.error(pc.red('❌ Error fatal en el instalador:'), err);
  process.exit(1);
});
