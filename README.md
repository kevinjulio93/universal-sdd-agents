# 🚀 Universal SDD Agents: Multi-Agent & Multi-Harness Engineering Ecosystem

[![Spec-Driven Development](https://img.shields.io/badge/Methodology-Spec--Driven%20Development%20(SDD)-blue.svg)](#-filosof%C3%ADa-spec-driven-development-sdd)
[![Quality Gates](https://img.shields.io/badge/Quality%20Gates-G0%20to%20G5-brightgreen.svg)](#-matriz-de-quality-gates-g0-a-g5)
[![Deterministic First](https://img.shields.io/badge/Tokens-Zero%20Waste%20Tooling-orange.svg)](#-ahorro-de-tokens-deterministic-first-llm-last)
[![Multi-Harness](https://img.shields.io/badge/Harnesses-Antigravity%20%7C%20Cursor%20%7C%20Claude%20Code%20%7C%20Windsurf-purple.svg)](#-compatibilidad-multi-harness)

Repositorio canónico (**Single Source of Truth**) que define y automatiza un equipo completo de ingeniería de software multiagente, gobernado por **Spec-Driven Development (SDD)**, **Quality Gates rigurosos (G0 a G5)**, servidores **MCP** sanitizados y **validación determinista Open Source** para garantizar un ahorro radical de tokens.

---

## 📑 Tabla de Contenidos
1. [Filosofía: Spec-Driven Development (SDD)](#-filosofía-spec-driven-development-sdd)
2. [Ahorro de Tokens: Deterministic First, LLM Last](#-ahorro-de-tokens-deterministic-first-llm-last)
3. [El Equipo: 9 Agentes Especializados](#-el-equipo-9-agentes-especializados)
4. [Matriz de Quality Gates (G0 a G5)](#-matriz-de-quality-gates-g0-a-g5)
5. [Herramientas Deterministas Open Source Integradas](#-herramientas-deterministas-open-source-integradas)
6. [Compatibilidad Multi-Harness](#-compatibilidad-multi-harness)
7. [Instalación Rápida en 1 Minuto](#-instalación-rápida-en-1-minuto)
8. [Configuración de MCPs y Secretos (.env)](#-configuración-de-mcps-y-secretos-env)
9. [Estructura del Proyecto](#-estructura-del-proyecto)

---

## 🎯 Filosofía: Spec-Driven Development (SDD)

En este flujo de trabajo:
> **Ninguna línea de código de producción se escribe hasta que la especificación (el contrato formal OpenAPI/AsyncAPI) esté completamente definida, validada sintácticamente y aprobada.**

La especificación es la **única fuente de verdad**. Si surge un cambio en los requerimientos, primero se actualiza la especificación; los Quality Gates y pruebas de contrato se encargarán automáticamente de rechazar cualquier código que sufra de *Spec Drift*.

---

## 💡 Ahorro de Tokens: "Deterministic First, LLM Last"

Los modelos de lenguaje no deben desperdiciar tokens analizando sintaxis de 2,000 líneas de OpenAPI, buscando vulnerabilidades tipográficas o simulando peticiones HTTP.
- **Herramientas deterministas locales y scripts CLI ($0 Tokens)** resuelven el 80% del trabajo mecánico en milisegundos.
- **Los Agentes LLM** únicamente se activan para razonamiento de alto nivel, diseño arquitectónico e implementación de lógica de negocio, recibiendo reportes ultra compactos (< 50 tokens).

---

## 🤖 El Equipo: 9 Agentes Especializados

| Agente | Rol y Responsabilidad |
| :--- | :--- |
| **`software-architect-orchestrator`** | Analiza requerimientos, toma decisiones técnicas de alto nivel, define límites de módulos y orquesta al resto de agentes. |
| **`spec-writer`** | Convierte las decisiones arquitectónicas en especificaciones formales (OpenAPI, JSON Schema, Acceptance Criteria). |
| **`backend-agent`** | Implementa APIs, endpoints, modelos, servicios y lógica de negocio estricta. |
| **`frontend-agent`** | Construye la interfaz de usuario, gestión de estado reactivo y accesibilidad, consumiendo directamente los mocks de la especificación. |
| **`database-agent`** | Diseña esquemas, relaciones, migraciones, optimización de queries, constraints e índices. |
| **`security-agent`** | Audita reglas de acceso (RBAC), endpoints seguros, protección de PII, sanitización y prevención de inyecciones. |
| **`quality-gate-evaluator`** | Evaluador **independiente** que audita evidencias, valida contratos y emite las decisiones de Gate 1 a Gate 5. |
| **`code-review-agent`** | Auditoría técnica de código: principios SOLID, mantenibilidad, estándares limpios y ausencia de bugs. |
| **`qa-agent`** | Validación funcional determinista: pruebas E2E, casos límite, pruebas de integración y no-regresión. |

---

## 🛡️ Matriz de Quality Gates (G0 a G5)

```text
[Requerimiento] ──(Gate 0)──> [Desarrollo Paralelo] ──(Gate 1)──> [Contratos] ──(Gate 2)
                                                                                   │
[Release / PR] ◄──(Gate 5)── [Pruebas & SAST] ◄──(Gate 4)── [Integración] ◄───────┘
```

| Gate | Nombre | Responsable | Criterio de Aprobación | Script Determinista |
| :--- | :--- | :--- | :--- | :--- |
| **GATE 0** | **Spec Quality Gate** | `spec-writer` | Spec sin errores de sintaxis; Score ≥ 95/100. | `scripts/gates/g0-spec-lint.sh` |
| **GATE 1** | **Agent Quality Gate** | Evaluador independiente | Exactitud ≥ 90/100, linter limpio, 0 fallos críticos. | `scripts/gates/g1-static-check.sh` |
| **GATE 2** | **Contract Gate** | Evaluador de contratos | **Zero Spec Drift**. 100% de contratos válidos. | `scripts/gates/g2-contract-test.sh` |
| **GATE 3** | **Integration Gate** | Evaluador de integración | 100% de flujos E2E críticos aprobados. | Test suite de integración |
| **GATE 4** | **Test, Coverage & Security Gate** | `qa-agent` + `quality-gate-evaluator` | Cobertura exacta SonarQube (Line y Branch ≥ 80%), SonarQube QG `OK`, 0 vulnerabilidades. | `scripts/gates/g4-test-and-security.sh` (`g4-sonarqube-analysis.sh`) |
| **GATE 5** | **Release Gate** | Evaluador final | Score global ≥ 90/100, SonarQube QG aprobado, aprobación unánime de gates. | `scripts/gates/g5-metrics-summary.sh` |

---

## 🛠️ Herramientas Deterministas Open Source Integradas

El repositorio incluye automatizaciones preconfiguradas con herramientas líderes de código abierto:
1. **Stoplight Spectral**: Linter automático de OpenAPI/AsyncAPI para el Gate 0.
2. **Stoplight Prism**: Servidor mock local instantáneo que levanta un backend falso desde la spec para que el frontend empiece a trabajar sin esperar al backend.
3. **Schemathesis**: Property-based contract testing que bombardea la API con casos límite reales para asegurar que no haya diferencias entre la spec y el código (Zero Drift).
4. **Semgrep**: Análisis estático de seguridad (SAST) ultra ligero para el Gate 4.
5. **SonarQube / SonarScanner**: Auditoría determinista de cobertura exacta (Líneas y Ramas/Condiciones) y validación estricta de Quality Gate (Line & Branch Coverage ≥ 80%, 0 vulnerabilidades, duplicación ≤ 3%).

---

## 🌐 Compatibilidad Multi-Harness

Puedes exportar o sincronizar este ecosistema hacia cualquier entorno de IA:
- **Google Antigravity**: Se enlaza a `~/.agents/` y se registra como plugin nativo con sus skills y MCPs.
- **Cursor IDE**: Genera `.cursorrules`, sub-reglas modulares en `.cursor/rules/*.mdc` y `.cursor/mcp.json`.
- **Claude Code**: Genera `CLAUDE.md` optimizado para la CLI de Anthropic.
- **Windsurf**: Genera `.windsurfrules` y configs de Cascade.
- **OpenCode / Codex / Roo-Code**: Compatible con los estándares de agentes y prompts Markdown del core.

---

## ⚡ Instalación Rápida con TUI CLI Interactivo

El repositorio incluye un **TUI CLI Interactivo (`sdd`)** con interfaz moderna de terminal (navegación por flechas, selección múltiple, spinners y diagnósticos en vivo) para desplegar el flujo SDD completo y gestionar SonarQube.

### 1. Clonar el repositorio
```bash
git clone git@github.com:kevinjulio93/universal-sdd-agents.git
cd universal-sdd-agents
npm install
npm link # Enlaza el comando 'sdd' globalmente
```

### 2. Ejecutar el Asistente Interactivo
```bash
sdd
# O modo diagnóstico del entorno:
sdd --doctor
```

El TUI te guiará paso a paso con selección interactiva:
```text
┌   🚀 UNIVERSAL SPEC-DRIVEN DEVELOPMENT (SDD) - TUI CLI 
│
◇  ¿Qué deseas hacer hoy?
│  ● 🚀 Instalación Completa del Flujo SDD (Recomendado)
│  ○ 🤖 Desplegar o Actualizar solo Agentes y Adaptadores IA
│  ○ 📊 Configurar / Iniciar SonarQube y Quality Gates (G4/G5)
│  ○ 🩺 Diagnóstico del Entorno (Doctor)
│
◇  ¿Dónde deseas aplicar la configuración?
│  ● 📁 Proyecto Actual (/path/to/project)
│  ○ 🌍 Global en tu Mac (~/ y ~/.agents)
│
◇  Selecciona los Harnesses de IA que deseas aprovisionar:
│  ◼ ✨ Todos los Harnesses (Ecosistema Completo)
│  ◻ Google Antigravity (~/.agents + plugin nativo)
│  ◻ Cursor IDE (.cursorrules, .cursor/rules/*.mdc, mcp.json)
│  ◻ Claude Code (CLAUDE.md modular)
│  ◻ Windsurf / Cascade (.windsurfrules)
│  ◻ OpenCode (~/.config/opencode/agents)
│
◇  Selecciona el Stack o Lenguaje principal de este entorno:
│  ● TypeScript / Node.js (Vitest/Jest con LCOV, Biome, tsc)
│  ○ Python (Pytest con Cobertura XML, Ruff, Mypy)
│  ○ Go (go test con coverage.out, golangci-lint)
│  ○ Java / Spring Boot (JUnit 5, JaCoCo XML, Maven/Gradle)
│  ○ Agnóstico / Políglota
│
◇  🔍 Auditoría y Aprovisionamiento de SonarQube:
│  ✔ Detección automática en vivo (http://localhost:9000 o Docker)
│  ✔ Opción para iniciar SonarQube Community automáticamente con Docker si no está activo
│  ✔ Generación y personalización de sonar-project.properties según tu stack
│  ✔ Fallback offline determinista ($0 tokens) sin necesidad de levantar servidor
```

### 🌍 Diferencia entre Modo Global y Modo Proyecto:
- **Modo Global (`~/.cursor/rules`, `~/.agents`, `~/CLAUDE.md`)**: Configura el equipo de agentes a nivel de usuario en tu Mac. Cualquier carpeta o proyecto nuevo que abras en tu editor heredará automáticamente a los 9 agentes y las Quality Gates sin tener que reconfigurar nada.
- **Modo Proyecto (`./.cursor/`, `./CLAUDE.md`, `./.windsurfrules`)**: Despliega los agentes y compuertas exclusivamente dentro de la carpeta actual. Ideal para compartir el flujo con tu equipo y commitear las reglas al repositorio de ese proyecto.

> [!TIP]
> **Adición incremental de harnesses:** Si hoy estás trabajando en **Cursor** y mañana quieres usar **Claude Code** o **Antigravity**, solo vuelve a ejecutar `sdd` y selecciona el nuevo harness. El CLI preservará tu configuración y generará los adaptadores correspondientes.

---

## 🔐 Configuración de MCPs y Secretos (.env)

El archivo `mcp/mcp_config.template.json` utiliza interpolación segura de variables `${VAR}`.
Edita tu `.env` local para definir:
- `CONTEXT7_MCP_URL`: Endpoint de Context7.
- `N8N_MCP_URL` & `N8N_MCP_TOKEN`: Tu instancia de n8n.
- `GOOGLE_DRIVE_MCP_URL`, `CANVA_MCP_URL`.
- `UVX_BIN` y `NPX_BIN`: Binarios locales para desktop-commander y markitdown.

Al ejecutar `node scripts/sync.js`, se compilan los archivos finales (`mcp_config.json`, `mcp.json`) sin exponer jamás credenciales en el repositorio de Git.

---

## 📂 Estructura del Proyecto

```text
universal-sdd-agents/
├── core/                         # FUENTE DE VERDAD (Agnóstica de Harness)
│   ├── agents/                   # Los 9 agentes maestros en Markdown
│   ├── rules/                    # Reglas AGENTS.md (Matriz G0-G5)
│   ├── skills/                   # Skills ejecutables (archify, find-skills, etc.)
│   └── templates/                # Plantillas de OpenAPI y especificaciones
├── tools/                        # Configuración de linters Open Source
│   ├── spectral.yaml             # Reglas para Spectral (Gate 0)
│   └── semgrep.yaml              # Reglas SAST para Semgrep (Gate 4)
├── adapters/                     # Configuraciones nativas generadas por harness
│   ├── antigravity/
│   ├── claude-code/
│   ├── cursor/
│   └── windsurf/
├── scripts/                      # SCRIPTS DETERMINISTAS ($0 TOKENS)
│   ├── install.sh                # Instalador multi-harness
│   ├── sync.js                   # Compilador de core a adaptadores
│   └── gates/                    # Comandos de ejecución de compuertas
│       ├── g0-spec-lint.sh
│       ├── g0-mock-server.sh
│       ├── g2-contract-test.sh
│       ├── g4-test-and-security.sh
│       └── g5-metrics-summary.sh
├── mcp/
│   └── mcp_config.template.json  # Plantilla de servidores MCP
├── .env.example                  # Plantilla de variables de entorno
└── README.md                     # Documentación principal
```

---

## 📄 Licencia
Distribuido bajo la licencia MIT. Eres libre de usar, modificar y desplegar este ecosistema en cualquiera de tus proyectos o entornos de desarrollo.
