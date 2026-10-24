const { spawnSync } = require('node:child_process');
const { fs, path, crypto, hash, readJson, writeJson, safePath, loadRun, scope, assertInitial } = require('./run');
const { delta } = require('../baseline');

const GATES = ['G0', 'G1', 'G2', 'G3', 'G4'];
const STATES = ['PASS', 'FAIL', 'BLOCKED', 'NOT_APPLICABLE'];
function configFor(file) {
  const config = readJson(file);
  if (config.version !== 1 || !config.gates || Object.keys(config.gates).some(g => !GATES.includes(g))) throw new Error('Expected version 1 configuration for G0–G4');
  if (!Array.isArray(config.acceptance) || !config.acceptance.length || config.acceptance.some(id => typeof id !== 'string' || !id.trim())) throw new Error('Active acceptance IDs required');
  if (config.requiredReviews && (!Array.isArray(config.requiredReviews) || config.requiredReviews.some(role => !['code-review-agent', 'quality-gate-evaluator', 'qa-agent', 'security-agent'].includes(role)))) throw new Error('Unknown review role');
  for (const gate of GATES) {
    const value = config.gates[gate];
    if (!value || typeof value.applicable !== 'boolean') throw new Error(`${gate}: explicit applicability required`);
    if (!value.applicable && !value.reason?.trim()) throw new Error(`${gate}: non-applicability requires a reason`);
    if (value.applicable && (!Array.isArray(value.checks) || !value.checks.length)) throw new Error(`${gate}: checks required`);
    const ids = new Set();
    for (const check of value.checks ?? []) {
      if (!/^[a-zA-Z0-9_-]+$/.test(check.id) || ids.has(check.id)) throw new Error(`${gate}: unique check ID required`);
      ids.add(check.id);
      if (!Array.isArray(check.command) || !check.command.length || check.command.some(arg => typeof arg !== 'string' || !arg || arg.includes('\0'))) throw new Error(`${gate}/${check.id}: argv command required`);
      if (!['json', 'exit-code', 'coverage'].includes(check.format)) throw new Error(`${gate}/${check.id}: unsupported format`);
      if (check.timeoutMs !== undefined && (!Number.isInteger(check.timeoutMs) || check.timeoutMs <= 0)) throw new Error('Invalid timeout');
      if (check.format === 'coverage' && (![check.lineThreshold, check.branchThreshold].every(n => typeof n === 'number' && n >= 0 && n <= 100) || !Array.isArray(check.files) || !check.files.length)) throw new Error('Coverage requires explicit source files and thresholds');
    }
  }
  return { config, digest: hash(JSON.stringify(config)) };
}
function findingKey(finding) {
  return JSON.stringify([finding.file, finding.rule, finding.message, finding.severity, finding.fingerprint]);
}
function diagnostics(data, root) {
  if (data.complete !== true || !Array.isArray(data.diagnostics)) throw new Error('Complete structured diagnostic report required');
  return data.diagnostics.map(item => {
    if (!item.file || !item.rule || !item.message || !item.fingerprint || !['info', 'warning', 'error', 'critical'].includes(item.severity)) throw new Error('Diagnostic identity/context/severity missing');
    const file = path.relative(root, safePath(root, item.file)).split(path.sep).join('/');
    if (item.line !== undefined && (!Number.isInteger(item.line) || item.line < 1)) throw new Error('Invalid diagnostic line');
    return { ...item, file };
  });
}
function classify(current, previous) {
  const counts = new Map();
  for (const item of previous) counts.set(findingKey(item), (counts.get(findingKey(item)) ?? 0) + 1);
  const debt = [], introduced = [];
  for (const item of current) {
    const key = findingKey(item), count = counts.get(key) ?? 0;
    if (count) { debt.push(item); counts.set(key, count - 1); } else introduced.push(item);
  }
  return { debt, introduced };
}
function coverageMetrics(data, check, changes, root) {
  if (data.complete !== true || !Array.isArray(data.coverage)) throw new Error('Complete line/branch coverage report required');
  const records = new Map();
  for (const item of data.coverage) {
    const file = path.relative(root, safePath(root, item.file)).split(path.sep).join('/');
    if (records.has(file) || !Array.isArray(item.lines) || !Array.isArray(item.branches)) throw new Error('Invalid/duplicate coverage file');
    for (const entry of [...item.lines, ...item.branches]) if (!Number.isInteger(entry.line) || entry.line < 1 || !Number.isFinite(entry.hits) || entry.hits < 0) throw new Error('Invalid coverage counter');
    if (new Set(item.lines.map(e => e.line)).size !== item.lines.length) throw new Error('Duplicate coverage lines');
    records.set(file, item);
  }
  const selected = check.files.map(file => path.relative(root, safePath(root, file)).split(path.sep).join('/'));
  const affected = changes.filter(c => selected.includes(c.file) && c.kind !== 'deleted');
  let lf = 0, lh = 0, bf = 0, bh = 0;
  for (const change of affected) {
    const record = records.get(change.file);
    if (!record || !record.lines.length) throw new Error(`Missing executable coverage data: ${change.file}`);
    for (const line of record.lines.filter(e => change.lines.includes(e.line))) { lf++; if (line.hits > 0) lh++; }
    for (const branch of record.branches.filter(e => change.lines.includes(e.line))) { bf++; if (branch.hits > 0) bh++; }
  }
  return { linesFound: lf, linesHit: lh, branchesFound: bf, branchesHit: bh,
    lineCoverage: lf ? lh / lf * 100 : null, branchCoverage: bf ? bh / bf * 100 : null,
    scope: 'changed-lines', affectedFiles: affected.map(c => c.file) };
}
function baseResult(run, gate, phase, configDigest) {
  return { version: 1, runId: run.manifest.runId, gate, phase, status: 'BLOCKED',
    startedAt: new Date().toISOString(), finishedAt: null, configDigest,
    scope: scope(run), baseline: { manifest: path.join(run.directory, 'baseline.json'), beforeDirectory: path.join(run.directory, 'before') },
    checks: [], findings: [], debt: [], gaps: [] };
}
function save(run, result) {
  result.finishedAt = new Date().toISOString();
  const output = path.join(run.directory, 'evidence', `${result.gate}.${result.phase}.json`);
  writeJson(output, result);
  return { ...result, report: output };
}
function executeGate({ directory, gate, phase = 'after', configPath, runner = spawnSync }) {
  if (!GATES.includes(gate) || !['before', 'after'].includes(phase)) throw new Error('Valid gate and phase required');
  const run = loadRun(directory), { config, digest } = configFor(configPath);
  if (phase === 'before') assertInitial(run);
  const definition = config.gates[gate], result = baseResult(run, gate, phase, digest);
  // Check definitions and cwd are validated before any process starts.
  for (const check of definition.checks ?? []) {
    if (check.cwd && check.cwd !== '.') {
      const cwd = safePath(run.manifest.root, check.cwd);
      if (!fs.statSync(cwd).isDirectory()) throw new Error('Check cwd must be a directory');
    }
    if (check.files?.some(file => !Object.hasOwn(run.manifest.files, file))) throw new Error('Coverage source files must belong to the baseline');
  }
  if (!definition.applicable) {
    result.status = 'NOT_APPLICABLE'; result.reason = definition.reason;
    return save(run, result);
  }
  const beforeFile = path.join(run.directory, 'evidence', `${gate}.before.json`);
  const prior = phase === 'after' && fs.existsSync(beforeFile) ? readJson(beforeFile) : null;
  const validPrior = prior && prior.runId === result.runId && prior.configDigest === digest &&
    prior.scope.digest === scope(run, 'before').digest && prior.scope.baselineDigest === result.scope.baselineDigest &&
    !prior.gaps.some(gap => !gap.check);
  const changes = delta(directory).changes;
  for (const check of definition.checks) {
    const started = Date.now();
    const cwd = check.cwd && check.cwd !== '.' ? safePath(run.manifest.root, check.cwd) : run.manifest.root;
    const execution = runner(check.command[0], check.command.slice(1), { cwd, encoding: 'utf8', timeout: check.timeoutMs ?? 120000,
      maxBuffer: 16 * 1024 * 1024, shell: false,
      env: { ...process.env, SDD_RUN: run.directory, SDD_ROOT: run.manifest.root, SDD_PHASE: phase,
        SDD_SCOPE_DIGEST: result.scope.digest, SDD_RUN_ID: result.runId } });
    const stdout = String(execution.stdout ?? ''), stderr = String(execution.stderr ?? '');
    const logPath = path.join(run.directory, 'evidence', `${gate}.${phase}.${check.id}.${crypto.randomUUID()}.log.json`);
    writeJson(logPath, { command: check.command, cwd, stdout, stderr });
    const entry = { id: check.id, command: check.command, cwd, exitCode: execution.status ?? null,
      durationMs: Date.now() - started, status: 'BLOCKED', evidence: logPath, evidenceDigest: hash(fs.readFileSync(logPath)), diagnostics: [] };
    try {
      if (execution.error || execution.signal || execution.status === null || execution.status === undefined) throw new Error(execution.error?.message ?? `Check terminated: ${execution.signal}`);
      if (check.format === 'exit-code') {
        entry.status = execution.status === 0 ? 'PASS' : 'BLOCKED';
        if (entry.status === 'BLOCKED') entry.gap = 'Nonzero unstructured result: reproduce/classify before attributing to old debt';
      } else {
        const data = JSON.parse(stdout);
        if (data.runId !== result.runId || data.scopeDigest !== result.scope.digest || data.phase !== phase) throw new Error('Report missing current run/scope/phase provenance');
        if (data.toolStatus === 'BLOCKED') throw new Error(data.reason ?? 'Tool unavailable/incomplete');
        if (check.format === 'coverage') {
          if (execution.status !== 0) throw new Error('Coverage producer failed');
          entry.metrics = coverageMetrics(data, check, changes, run.manifest.root);
          const m = entry.metrics;
          entry.status = (m.lineCoverage !== null && m.lineCoverage < check.lineThreshold) ||
            (m.branchCoverage !== null && m.branchCoverage < check.branchThreshold) ? 'FAIL' : 'PASS';
        } else {
          entry.diagnostics = diagnostics(data, run.manifest.root);
          if (execution.status !== 0 && !entry.diagnostics.length) throw new Error('Nonzero exit without diagnostics');
          const priorCheck = validPrior ? prior.checks.find(c => c.id === check.id && c.status !== 'BLOCKED') : null;
          const comparable = priorCheck && hash(fs.readFileSync(safePath(run.directory, priorCheck.evidence))) === priorCheck.evidenceDigest;
          const previous = comparable ? priorCheck.diagnostics : [];
          const classified = classify(entry.diagnostics, previous);
          entry.debt = classified.debt;
          entry.findings = classified.introduced;
          result.debt.push(...classified.debt.map(item => ({ ...item, check: check.id })));
          result.findings.push(...classified.introduced.map(item => ({ ...item, check: check.id })));
          entry.status = classified.introduced.length ? (phase === 'after' && !comparable ? 'BLOCKED' : 'FAIL') : 'PASS';
          if (entry.status === 'BLOCKED') entry.gap = 'Findings have no comparable before evidence; attribution requires investigation';
        }
      }
    } catch (error) { entry.status = 'BLOCKED'; entry.gap = error.message; }
    if (entry.gap) result.gaps.push({ check: check.id, message: entry.gap });
    result.checks.push(entry);
  }
  if (scope(run).digest !== result.scope.digest) result.gaps.push({ message: 'Validation mutated scoped inputs; evidence invalidated' });
  result.status = result.gaps.length ? 'BLOCKED' : result.checks.some(c => c.status === 'FAIL') ? 'FAIL' : 'PASS';
  return save(run, result);
}

function recordReview({ directory, role, harness, parent, slot = 'default', sessionId, verdict, findings = [], evidence = [], acceptance = [], reason }) {
  const run = loadRun(directory);
  if (!['code-review-agent', 'quality-gate-evaluator', 'qa-agent', 'security-agent'].includes(role) || !['APPROVED', 'CHANGES_REQUIRED', 'BLOCKED'].includes(verdict)) throw new Error('Invalid independent review');
  if (!reason?.trim() || !Array.isArray(findings) || !Array.isArray(evidence) || !evidence.length || !Array.isArray(acceptance) || !acceptance.length) throw new Error('Review needs rationale, acceptance IDs and evidence paths');
  if (verdict === 'APPROVED' && findings.length) throw new Error('Approval cannot contain unresolved findings');
  const registry = readJson(path.join(run.directory, 'sessions.json'));
  const entry = registry.sessions[JSON.stringify([harness, parent, role, slot])];
  if (registry.runId !== run.manifest.runId || !entry || entry.id !== sessionId) throw new Error('Review must reference a registered independent reviewer session');
  const checkedEvidence = evidence.map(file => {
    const absolute = safePath(run.directory, file);
    const bytes = fs.readFileSync(absolute);
    return { path: path.relative(run.directory, absolute), digest: hash(bytes) };
  });
  const review = { version: 1, runId: run.manifest.runId, scope: scope(run), role, harness, parent, sessionId,
    verdict, findings, evidence: checkedEvidence, acceptance, reason, recordedAt: new Date().toISOString() };
  writeJson(path.join(run.directory, 'evidence', `review.${role}.json`), review);
  return review;
}
function release({ directory, configPath }) {
  const run = loadRun(directory), { config, digest } = configFor(configPath);
  const result = baseResult(run, 'G5', 'after', digest);
  for (const gate of GATES) {
    try {
      const file = path.join(run.directory, 'evidence', `${gate}.after.json`), report = readJson(file);
      if (report.version !== 1 || report.runId !== result.runId || report.gate !== gate || report.phase !== 'after' || report.configDigest !== digest ||
          report.scope.digest !== result.scope.digest || report.scope.baselineDigest !== result.scope.baselineDigest || !STATES.includes(report.status)) throw new Error('Missing/stale/wrong-scope gate evidence');
      if (!['PASS', 'NOT_APPLICABLE'].includes(report.status)) throw new Error(`Gate is ${report.status}`);
      if ((report.status === 'NOT_APPLICABLE') !== !config.gates[gate].applicable || (report.status === 'NOT_APPLICABLE' && report.reason !== config.gates[gate].reason)) throw new Error('Applicability mismatch');
      if (report.status === 'PASS' && (!report.checks.length || report.checks.some(c => c.status !== 'PASS') || report.gaps.length || report.findings.length)) throw new Error('Inconsistent gate summary');
      if (report.status === 'PASS' && JSON.stringify(report.checks.map(c => c.id)) !== JSON.stringify(config.gates[gate].checks.map(c => c.id))) throw new Error('Missing configured checks');
      for (const check of report.checks) if (hash(fs.readFileSync(safePath(run.directory, check.evidence))) !== check.evidenceDigest) throw new Error('Missing/changed command log');
      result.checks.push({ id: gate, status: report.status, evidence: file });
      result.debt.push(...report.debt);
    } catch (error) { result.gaps.push({ check: gate, message: error.message }); }
  }
  const requiredReviews = [...new Set(['code-review-agent', 'quality-gate-evaluator', ...(config.requiredReviews ?? [])])];
  for (const role of requiredReviews) {
    try {
      const review = readJson(path.join(run.directory, 'evidence', `review.${role}.json`));
      if (review.role !== role || review.runId !== result.runId || review.scope.digest !== result.scope.digest || review.scope.baselineDigest !== result.scope.baselineDigest || review.verdict !== 'APPROVED' || review.findings.length) throw new Error('Independent approval missing/stale');
      if (!review.evidence.length || !review.acceptance.length) throw new Error('Empty review evidence');
      if (['code-review-agent', 'quality-gate-evaluator'].includes(role) && config.acceptance.some(id => !review.acceptance.includes(id))) throw new Error('Active acceptance not covered by independent review');
      if (role === 'quality-gate-evaluator' && GATES.some(g => !review.evidence.some(e => e.path === `evidence/${g}.after.json`))) throw new Error('Gate evaluator must inspect all G0–G4 artifacts');
      const registry = readJson(path.join(run.directory, 'sessions.json'));
      if (registry.runId !== result.runId || !Object.values(registry.sessions).some(s => s.role === role && s.harness === review.harness && s.parent === review.parent && s.id === review.sessionId)) throw new Error('Independent reviewer session no longer registered');
      for (const item of review.evidence) if (hash(fs.readFileSync(safePath(run.directory, item.path))) !== item.digest) throw new Error('Reviewed evidence changed; resume reviewer');
      result.checks.push({ id: role, status: 'PASS', evidence: path.join(run.directory, 'evidence', `review.${role}.json`) });
    } catch (error) { result.gaps.push({ check: role, message: error.message }); }
  }
  result.status = result.gaps.length ? 'BLOCKED' : 'PASS';
  result.decision = result.status === 'PASS' ? 'RELEASE_APPROVED' : 'NOT_APPROVED';
  return save(run, result);
}
module.exports = { executeGate, release, recordReview, classify, coverageMetrics, configFor };
