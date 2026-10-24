# 🚀 Universal SDD Agents: Multi-Agent & Multi-Harness Engineering Ecosystem

[![Spec-Driven Development](https://img.shields.io/badge/Methodology-Spec--Driven%20Development%20(SDD)-blue.svg)](#-filosofía-spec-driven-development-sdd)
[![Quality Gates](https://img.shields.io/badge/Quality%20Gates-G0%20to%20G5-brightgreen.svg)](#-matriz-de-quality-gates-g0-a-g5)
[![Deterministic First](https://img.shields.io/badge/Validation-Delta%20%26%20Evidence-orange.svg)](#-ahorro-de-tokens-deterministic-first-llm-last)
[![Multi-Harness](https://img.shields.io/badge/Harnesses-Antigravity%20%7C%20Cursor%20%7C%20Claude%20Code%20%7C%20Windsurf%20%7C%20OpenCode-purple.svg)](#-compatibilidad-multi-harness)

Repositorio canónico (**Single Source of Truth**) de un equipo de ingeniería de **13 agentes**, gobernado por **Spec-Driven Development (SDD)** y **Quality Gates G0–G5**. Separa coordinación, arquitectura, planificación, implementación y revisión adversarial; utiliza **baseline sin Git**, **sesiones reutilizables** y **evidencias sobre los cambios de cada ejecución**.

---

## 📑 Tabla de Contenidos
1. [Filosofía: Spec-Driven Development (SDD)](#-filosofía-spec-driven-development-sdd)
2. [Ahorro de Tokens: Deterministic First, LLM Last](#-ahorro-de-tokens-deterministic-first-llm-last)
3. [El Equipo: 13 Agentes Especializados](#-el-equipo-13-agentes-especializados)
4. [Matriz de Quality Gates (G0 a G5)](#-matriz-de-quality-gates-g0-a-g5)
5. [Herramientas Deterministas Open Source Integradas](#-herramientas-deterministas-open-source-integradas)
6. [Compatibilidad Multi-Harness](#-compatibilidad-multi-harness)
7. [Instalación Rápida con TUI CLI Interactivo](#-instalación-rápida-con-tui-cli-interactivo)
8. [Configuración de MCPs y Secretos (.env)](#-configuración-de-mcps-y-secretos-env)
9. [Estructura del Proyecto](#-estructura-del-proyecto)

---

## 🎯 Filosofía: Spec-Driven Development (SDD)

> La implementación parte de una especificación activa con aceptación verificable y contratos definidos cuando resulten aplicables.

SDD no exige OpenAPI para cambios que no afecten una API. `spec-writer` escribe requisitos y contratos; `software-architect` resuelve decisiones técnicas; `planner-agent` convierte esa definición en tareas y dependencias. `orchestrator` coordina su ejecución sin implementar código ni sustituir estas responsabilidades.

```text
Objetivo → Baseline → Decisión arquitectónica cuando sea necesaria
        → Spec + G0 → Plan de tareas → Implementación por propietarios
        → G1–G4 → Revisión adversarial → Reparación con la misma sesión → G5
```

### Baseline y alcance de la ejecución

- Captura los contenidos iniciales **antes de editar**, incluyendo archivos nuevos aún inexistentes.
- Funciona en carpetas con o sin Git, sin crear commits ni revertir trabajo del usuario.
- Permite extender archivos asignados sin sobrescribir las copias originales.
- Entrega `runId`, `directory`, `manifest` y `beforeDirectory`; estas rutas acompañan al handoff de revisión.
- Identifica archivos añadidos, modificados, eliminados y líneas actuales cambiadas.
- El alcance incluye los archivos de implementación y las entradas/dependencias relevantes para los checks. No constituye un sandbox ni descubre por sí solo todas las dependencias.

**La deuda previa se informa; los defectos nuevos o agravados bloquean.** Un fallo cuya procedencia no pueda demostrarse se mantiene como `BLOCKED`. No se descarta una regresión porque aparezca en un consumidor no editado.

Para comparar diagnósticos, ejecuta los checks `before` antes de modificar sus entradas y los checks `after` sobre el resultado. Si primero hay que preparar la especificación, puede cerrarse esa ejecución y comenzar la implementación con un nuevo baseline de la spec aprobada. Las extensiones de alcance invalidan evidencias antiguas.

---

## 💡 Ahorro de Tokens: "Deterministic First, LLM Last"

Las herramientas locales resuelven comprobaciones mecánicas; los agentes interpretan requisitos, implementan y revisan semántica. Sus invocaciones y salidas siguen consumiendo contexto: no se presupone un porcentaje de ahorro ni un coste de tokens nulo.

### Carga progresiva

1. **Runtime core compacto:** `core/rules/AGENTS.md` contiene las invariantes compartidas.
2. **Agente breve:** responsabilidad y límites, sin duplicar manuales completos.
3. **Skill de rol + `sdd-protocol`:** se cargan una vez por sesión.
4. **Referencias y stack:** se consultan únicamente cuando la decisión lo necesita.

`core/roles.json` es la fuente canónica de capacidades. `scripts/sync.js` genera los adaptadores; no se mantienen cabeceras de permisos duplicadas manualmente.

### Reutilización de sesiones

`scripts/sessions.js` registra IDs reales por **ejecución + harness + sesión padre + rol + propietario**. Antes de cada delegación, el coordinador consulta el registro:

- Si existe un ID, reanuda esa sesión, también para nuevas tareas del mismo propietario.
- La reanudación utiliza el mecanismo nativo del harness, cuando está disponible.
- Las reparaciones conservan los propietarios y revisores originales.
- Los propietarios concurrentes usan slots distintos y archivos sin solapamientos.
- Una sesión expirada solo se sustituye registrando el motivo; el contexto se recarga entonces o si cambian las instrucciones.

El registro no lanza agentes ni garantiza la retención del contexto por el proveedor. El coordinador debe usar la herramienta nativa disponible. Los harnesses sin reanudación verificable lo declaran explícitamente. Los handoffs usan referencias y deltas, no copias completas del historial.

---

## 🤖 El Equipo: 13 Agentes Especializados

| Agente | Responsabilidad exclusiva | Capacidades canónicas |
| :--- | :--- | :--- |
| **`orchestrator`** | Coordina alcance, propietarios, sesiones, checks y reparaciones. | Lectura, delegación a roles definidos, shell de validación sujeto a permisos; sin edición directa. |
| **`software-architect`** | Decide arquitectura, límites, contratos y compatibilidad. | Solo lectura; sin planificación operativa, shell o delegación. |
| **`planner-agent`** | Descompone la spec en tareas, dependencias, archivos, propietarios y evidencias. | Solo lectura; sin modificar requisitos ni arquitectura. |
| **`spec-writer`** | Escribe requisitos, aceptación y contratos aprobados. | Edición de rutas asignadas bajo `spec/`; sin shell ni delegación. |
| **`backend-agent`** | Implementa backend y tests asociados. | Edición de archivos asignados; sin shell ni delegación. |
| **`frontend-agent`** | Implementa UI, accesibilidad y tests asociados. | Edición de archivos asignados; sin shell ni delegación. |
| **`database-agent`** | Implementa esquemas, migraciones y tests de compatibilidad. | Edición asignada; no ejecuta migraciones ni shell. |
| **`ai-engineer`** | Implementa modelos, prompts, RAG, agentes IA y activos de evaluación. | Edición de archivos asignados; sin shell, delegación ni autoaprobación. |
| **`automation-integration-agent`** | Implementa conectores API/MCP, webhooks y automatizaciones. | Edición asignada; sin shell ni ejecución autónoma de workflows o efectos remotos. |
| **`security-agent`** | Audita límites de confianza y regresiones de seguridad. | Solo lectura; informa defectos, no los repara. |
| **`code-review-agent`** | Revisión **adversarial, estricta e independiente** del delta y sus evidencias. | Solo lectura; sin shell, edición o delegación. |
| **`qa-agent`** | Diseña escenarios y verifica evidencias funcionales de aceptación. | Solo lectura; solicita ejecuciones al coordinador. |
| **`quality-gate-evaluator`** | Audita vigencia, alcance, atribución y suficiencia de G0–G5. | Solo lectura; sin autocertificación ni puntuaciones inventadas. |

El revisor adversarial intenta refutar los resultados con contraejemplos de límites, errores, concurrencia, autorización, consumidores y tests insuficientes. Cada hallazgo requiere severidad, `path:line`, evidencia, impacto y corrección mínima. **Ser estricto no significa inventar defectos, bloquear por gustos o exigir limpieza ajena al objetivo.**

Los implementadores proponen checks; el coordinador los ejecuta. Los resultados de conversación son Markdown compacto, normalmente hasta 150 palabras, salvo planes o múltiples defectos accionables. El JSON estricto se reserva a evidencias procesables por herramientas.

### IA y automatizaciones

`qa-agent` carga **`ai-evaluation`** para revisar datasets, rúbricas, repeticiones, tamaño muestral, confianza, calibración del juez LLM, calidad, coste y latencia. `security-agent` carga **`ai-security`** para prompt injection, mínimo privilegio de tools, exfiltración, aislamiento de tenants, PII y consentimiento en reuniones. Los implementadores pueden consultar estas skills sin adquirir permisos adicionales; el código compartido sigue asignándose al especialista correspondiente, sin solapar archivos.

**No se activa `ai-evaluation-agent`.** La evaluación permanece bajo QA. Su eventual promoción exige evidencia de al menos tres cambios IA con carga recurrente, una separación de responsabilidades aprobada, runner/suites reproducibles y aprobación explícita de una spec/ADR. Entonces deberán actualizarse registro de roles/sesiones, allowlists de review y release, adaptadores/permisos, despliegue y tests. Consulta los [criterios completos y el workflow IA](core/references/ai-workflow.md).

[`checks.ai.example.json`](core/templates/checks.ai.example.json) mantiene G0–G4 y añade revisiones QA/security a las obligatorias de código y gates. Sus comandos son **A IMPLEMENTAR por el consumidor**, no scripts existentes ni evidencia. El runner del consumidor puede gatear calidad/coste/latencia/seguridad mediante `exit-code`: runner ausente o resultado no cero implica `BLOCKED`, no un `FAIL` clasificado ni aprobación. No se introduce un formato de gate IA. Mocks no equivalen a evidencia real de un LLM; llamadas live y efectos remotos requieren permisos explícitos y presupuestos aplicados.

---

## 🛡️ Matriz de Quality Gates (G0 a G5)

Se conserva G0–G5 como interfaz conceptual. Todos sus resultados comparten el [contrato técnico v1](core/references/evidence-contract.md) y su [JSON Schema](core/schemas/gate-result.schema.json).

```text
[Requerimiento + Spec] → [G0] → [Implementación] → [G1: Estática] → [G2: Contratos]
                                                                        │
[G5: Release] ← [Revisión independiente] ← [G4: Tests y seguridad] ← [G3: Integración]
```

| Gate | Nombre | Evidencia exigida sobre el alcance | Entrada |
| :--- | :--- | :--- | :--- |
| **G0** | Spec Quality Gate | Comprobaciones de la spec activa y aceptación verificable. | `scripts/gates/g0-spec-lint.sh` |
| **G1** | Agent / Static Gate | Checks estáticos configurados; sin diagnósticos nuevos o agravados. | `scripts/gates/g1-static-check.sh` |
| **G2** | Contract Gate | Contratos y consumidores afectados; pruebas configuradas según el cambio. | `scripts/gates/g2-contract-test.sh` |
| **G3** | Integration Gate | Flujos de integración relevantes para la aceptación. | `scripts/gates/g3-integration-test.sh` |
| **G4** | Test, Coverage & Security Gate | Tests actuales, seguridad diferencial y cobertura del delta cuando se configure. | `scripts/gates/g4-test-and-security.sh` |
| **G5** | Release Gate | G0–G4 vigentes y aprobaciones independientes ligadas a aceptación y evidencias. | `scripts/gates/g5-metrics-summary.sh` |

### Contrato común

Cada resultado incluye identidad de ejecución, gate, fase, estado, fechas, hash de configuración, archivos/hashes del alcance, rutas del baseline, comandos, códigos de salida, duración, logs, hallazgos, deuda previa y lagunas.

Estados: **`PASS`**, **`FAIL`**, **`BLOCKED`** y **`NOT_APPLICABLE`**. Este último requiere una justificación explícita revisada contra la aceptación.

- Una herramienta ausente, un reporte incompleto o evidencia obsoleta nunca equivale a aprobación.
- Los diagnósticos estructurados se comparan con su captura inicial por identidad, contexto y severidad, conservando duplicados.
- Un check que solo aporta exit code puede acreditar éxito; su fallo requiere diagnóstico antes de atribuirse a deuda previa.
- La cobertura usa líneas actuales cambiadas, no la cobertura global histórica. Sin líneas ejecutables cambiadas se informa `null`, no 100 % ficticio.
- Sonar ejecuta un análisis fresco y compara snapshots completos de issues. Un Quality Gate global rojo por deuda histórica no rechaza por sí solo la tarea. Cobertura, hotspots y duplicación requieren checks separados cuando formen parte de la aceptación.
- G5 consume evidencia real: no acepta métricas favorables por defecto ni aprueba con errores. Siempre exige `code-review-agent` y `quality-gate-evaluator`; pueden configurarse revisiones adicionales.

Las evidencias son locales, no firmas del proveedor: el coordinador registra respuestas auténticas de revisores. Los hashes detectan obsolescencia/cambios, no sustituyen una frontera de seguridad contra quien pueda reescribir todos los artefactos.

---

## 🛠️ Herramientas Deterministas Open Source Integradas

1. **Baseline universal:** `scripts/baseline.js`, sin dependencia de Git y con copias iniciales inmutables por extensión.
2. **Registro de sesiones:** `scripts/sessions.js`, lookup/resume por rol y propietario.
3. **Ejecutor común:** `scripts/gate.js`, argv sin shell implícito, timeout, logs y comparación de evidencias.
4. **Spectral y Semgrep:** `scripts/check.js` normaliza la salida de una ejecución fresca; configuración local en `tools/`.
5. **Prism y Schemathesis:** mock API y contract testing cuando corresponda; los comandos se eligen explícitamente en la configuración del proyecto.
6. **LCOV:** productor de cobertura fresco y métricas sobre líneas cambiadas; sin reutilizar silenciosamente reportes anteriores.
7. **SonarQube:** `scripts/sonar-check.js` espera su análisis, verifica paginación/procedencia y rechaza snapshots incompletos o carreras con otro análisis.
8. **Pruebas del protocolo:** `npm test` ejecuta la suite local de baseline, sesiones, permisos, despliegue, atribución de deuda, cobertura y release; la existencia de tests no acredita por sí sola que la ejecución actual haya pasado.

Las herramientas externas deben estar instaladas y versionadas por el proyecto. El runner no las descarga automáticamente. Consulta [uso de herramientas](core/references/tooling.md) para productores, comandos y límites de integración.

---

## 🌐 Compatibilidad Multi-Harness

| Harness | Adaptador | Restricciones y límites |
| :--- | :--- | :--- |
| **OpenCode** | Agentes nativos, modos y `permission` generados. | Denegación efectiva por herramientas; alcance dinámico de archivos requiere revisión. El shell del coordinador pide permiso. |
| **Claude Code** | `.claude/agents`, allowlists y `disallowedTools`. | Lectores sin edición/shell; coordinador principal mediante `--agent orchestrator`. Asignación dinámica de rutas es procedimental. |
| **Cursor** | Reglas SDD y capacidades canónicas. | Este adaptador no impone permisos independientes por rol ni garantiza reanudación nativa. |
| **Windsurf** | Reglas SDD en `.windsurf/rules` y skills. | Restricciones procedimentales; verificar capacidades del runtime instalado. |
| **Antigravity** | Prompts y herramientas anunciadas por rol. | Las listas anunciadas no se presentan como una frontera de permisos verificada. |

Detalles y limitaciones en [harness-support.md](core/references/harness-support.md). Las restricciones del harness no convierten comandos de shell aprobados en operaciones de solo lectura. Las sesiones simultáneas necesitan archivos disjuntos o checkouts aislados.

---

## ⚡ Instalación Rápida con TUI CLI Interactivo

El repositorio incluye un **TUI CLI Interactivo (`sdd`)** con navegación por flechas, selección múltiple, spinners y diagnóstico del entorno. El asistente te guía paso a paso para desplegar el equipo de agentes, elegir tus herramientas de IA y configurar SonarQube de forma opcional.

Requisito del runtime: **Node.js >=22**. Compatible con macOS, Linux y Windows; el aprovisionamiento de herramientas externas depende del sistema y de los permisos disponibles.

### 1. Clonar y preparar el repositorio

```bash
git clone git@github.com:kevinjulio93/universal-sdd-agents.git
cd universal-sdd-agents
npm install
npm test
npm link # Habilita el comando sdd para ejecutarlo desde tus proyectos
```

### 2. Ejecutar el Asistente Interactivo

```bash
# Desde la carpeta del proyecto donde quieres instalar el flujo:
sdd

# O ejecutar únicamente el diagnóstico del entorno:
sdd --doctor
```

**El TUI te guiará paso a paso con selección interactiva.** Este es un ejemplo resumido del recorrido de instalación completa; las opciones de diagnóstico o configuración de SonarQube muestran solo los pasos que necesitan:

```text
┌   🚀 UNIVERSAL SPEC-DRIVEN DEVELOPMENT (SDD) - TUI CLI
│
◇  ¿Qué deseas hacer hoy?
│  ● 🚀 Instalación Completa del Flujo SDD (Recomendado)
│  ○ 🤖 Desplegar o Actualizar solo Agentes y Adaptadores IA
│  ○ 📊 Configurar / Iniciar SonarQube (opcional)
│  ○ 🩺 Diagnóstico del Entorno (Doctor)
│
◇  Comprobación de dependencias del entorno
│  Diagnóstico y opciones para resolver herramientas ausentes
│
◇  ¿Dónde deseas aplicar la configuración?
│  ● 📁 Proyecto Actual (/ruta/al/proyecto)
│  ○ 🌍 Global en tu sistema (~/.sdd/global)
│
◇  Selecciona los Harnesses de IA que deseas aprovisionar:
│  ◼ ✨ Todos los Harnesses (Ecosistema Completo)
│  ◻ Google Antigravity
│  ◻ Cursor IDE
│  ◻ Claude Code
│  ◻ Windsurf / Cascade
│  ◻ OpenCode
│
◇  Selecciona el Stack o Lenguaje principal de este entorno:
│  ● TypeScript / Node.js
│  ○ Python
│  ○ Go
│  ○ Java / Spring Boot
│  ○ Agnóstico / Políglota
│
◇  Configuración opcional de SonarQube
│  Detección del servicio y opciones de configuración según el entorno
│  Posibilidad de iniciar un servidor local con Docker
│  Generación de sonar-project.properties según tu stack
│  Opción de continuar sin SonarQube, sin simular resultados
│
◇  ¿Proceder con la instalación en modo PROYECTO o GLOBAL?
│  Compilación, despliegue y resumen con notas de integración
└
```

El TUI, el instalador shell y el comando directo utilizan **el mismo mecanismo de compilación y despliegue**. Instalan los 13 roles, sus skills y las herramientas G0–G5; no ejecutan gates, no generan aprobaciones y no autorizan llamadas a proveedores ni efectos remotos.

### 🌍 Diferencia entre Modo Global y Modo Proyecto

- **Modo Proyecto:** instala los recursos en `./.sdd/` y los adaptadores en las carpetas nativas del proyecto. Es la opción recomendada para trabajar con alcance explícito y compartir el flujo con tu equipo.
- **Modo Global:** instala los recursos compartidos en `~/.sdd/global/` y los adaptadores en las ubicaciones de usuario correspondientes. Su descubrimiento depende del harness; puede requerir importar reglas o integrar configuración explícitamente. No se presupone que cualquier proyecto los herede automáticamente.
- **Protección de personalizaciones:** el manifiesto de instalación identifica los archivos gestionados. Un archivo generado modificado por el usuario provoca un conflicto explícito, no una sobrescritura silenciosa.

> [!TIP]
> **Adición incremental de harnesses:** vuelve a ejecutar `sdd`, elige el mismo alcance y selecciona el nuevo harness. El instalador añade sus adaptadores y conserva las configuraciones existentes; si encuentra personalizaciones incompatibles, solicita resolver el conflicto.

### Notas de integración por herramienta

Después del despliegue, revisa el resumen del asistente y **recarga o reinicia tu herramienta de IA cuando sea necesario** para que descubra los nuevos agentes, reglas y skills. Los detalles dependen del harness:

- **OpenCode:** requiere reiniciar tras instalar o actualizar su configuración. Si ya existe configuración del usuario, el instalador entrega un fragmento `sdd.config.json` para integrarlo explícitamente.
- **Claude Code:** si ya existe `CLAUDE.md`, se conserva y se entrega `.claude/SDD.md` para incluirlo explícitamente. El coordinador nativo se selecciona mediante `claude --agent orchestrator`.
- **Cursor, Windsurf y Antigravity:** comprueba el descubrimiento de reglas y skills en la versión instalada, especialmente en modo global. Sus límites están descritos en la [compatibilidad por harness](core/references/harness-support.md).

En instalaciones anteriores, revisa y desactiva el agente obsoleto `software-architect-orchestrator`. El instalador no elimina automáticamente agentes o personalizaciones existentes.

### Instalación directa opcional

Si prefieres automatizar el despliegue sin navegar por el asistente, ejecuta desde el repositorio de Universal SDD Agents:

```bash
# Todos los adaptadores en un proyecto existente:
node scripts/deploy.js --target=/ruta/al/proyecto --harnesses=all

# Instalación a nivel de usuario:
node scripts/deploy.js --global=true --harnesses=all
```

Puedes sustituir `all` por una lista separada por comas de `antigravity`, `cursor`, `claude`, `windsurf` u `opencode`. `npm run sync` regenera adaptadores sin instalar; no es un paso separado necesario para el despliegue.

### 3. Iniciar una ejecución SDD

Tras instalar, configura los checks del proyecto. Los siguientes ejemplos usan una instalación **en modo Proyecto** y son independientes del harness seleccionado:

```bash
node .sdd/scripts/baseline.js --files=src/example.ts,tests/example.test.ts
```

Guarda la ruta `directory` devuelta. Prepara `.sdd/checks.json` a partir de `.sdd/core/templates/checks.example.json`, adaptando comandos, aceptación y aplicabilidad.

Para IA usa `.sdd/core/templates/checks.ai.example.json` y la [referencia IA](core/references/ai-workflow.md). Implementa primero los comandos `A_IMPLEMENTAR`; incluye en el alcance prompts, planes de evaluación, manifests de datasets/retrieval/tools y versiones de runner. Los hashes locales no detectan por sí solos cambios remotos de modelos o índices.

```bash
node .sdd/scripts/gate.js --gate=G1 --phase=before --run=/ruta/sdd-run-... --config=.sdd/checks.json
# Implementación por los propietarios, reutilizando sus sesiones.
node .sdd/scripts/gate.js --gate=G1 --phase=after --run=/ruta/sdd-run-... --config=.sdd/checks.json
```

Ejecuta G0–G4 según su configuración, registra las respuestas independientes mediante `review.js` y agrega con G5. El [procedimiento completo](core/references/tooling.md) incluye sesiones, revisión y cobertura. Los wrappers shell aceptan los mismos argumentos nombrados; ya no admiten porcentajes posicionales de aprobación.

---

## 🔐 Configuración de MCPs y Secretos (.env)

`mcp/mcp_config.template.json` conserva placeholders para Context7, n8n y otros servidores. La sincronización genera **plantillas**, no expande credenciales a archivos de adaptadores. Configura los MCP con el formato nativo y los permisos adecuados de cada harness; no se instala una configuración MCP universal suponiendo equivalencia de esquemas.

Variables relevantes:

- `CONTEXT7_MCP_URL`, `N8N_MCP_URL`, `N8N_MCP_TOKEN`.
- `GOOGLE_DRIVE_MCP_URL`, `CANVA_MCP_URL`, `UVX_BIN`, `NPX_BIN`.
- `SONAR_HOST_URL`, `SONAR_TOKEN` para `sonar-check.js`.

Los comandos de validación consumen variables del proceso; no cargan automáticamente `.env`. El token de Sonar no se escribe en `sonar-project.properties`. No incluyas secretos en argumentos de checks, porque sus comandos forman parte de las evidencias.

---

## 📂 Estructura del Proyecto

```text
universal-sdd-agents/
├── core/
│   ├── roles.json                  # Capacidades canónicas de los 13 roles
│   ├── agents/                     # Prompts breves por responsabilidad
│   ├── rules/AGENTS.md             # Runtime core compartido
│   ├── skills/                     # Protocolo, skills de rol y catálogos opcionales
│   ├── references/                 # Workflow, herramientas, evidencias y límites
│   ├── schemas/gate-result.schema.json
│   ├── templates/                  # checks.example.json y checks.ai.example.json
│   └── stacks/                     # Referencias cargadas bajo demanda
├── adapters/
│   ├── opencode/                   # Agentes + permisos + fragmento de configuración
│   ├── claude-code/                # Agentes nativos + tools/disallowedTools
│   ├── antigravity/
│   ├── cursor/
│   └── windsurf/
├── scripts/
│   ├── sync.js                     # Generación desde el core
│   ├── deploy.js                   # Despliegue con detección de conflictos
│   ├── install.sh
│   ├── baseline.js                 # Copias iniciales y delta, sin Git
│   ├── sessions.js                 # Registro y lookup de sesiones
│   ├── gate.js                     # Ejecución común G0–G5
│   ├── check.js                    # Adaptadores de diagnósticos y LCOV
│   ├── sonar-check.js              # Snapshot fresco de issues Sonar
│   ├── review.js                   # Registro de respuestas independientes
│   ├── lib/                        # Validación, integridad y comparación
│   └── gates/                      # Wrappers G0–G5
├── tests/                          # Pruebas del protocolo y tooling
├── tools/                          # Reglas Spectral/Semgrep y configuración Sonar
├── bin/sdd.js                      # TUI de instalación y diagnóstico
├── mcp/mcp_config.template.json
├── .env.example
└── README.md
```

Cada ejecución conserva temporalmente `baseline.json`, `before/`, `sessions.json` y `evidence/` fuera del código del proyecto. Sus rutas acompañan al revisor. No existe un bloqueo global de sesiones ni un estado de entrega que impida comenzar otra ejecución.

---

## 📄 Licencia

Distribuido bajo la licencia MIT. Eres libre de usar, modificar y desplegar este ecosistema en tus proyectos.
