#!/usr/bin/env node
// Normalize a fresh tool invocation. No existing report is silently reused.
const { spawnSync } = require('node:child_process');
const { fs, path, crypto, hash, safePath } = require('./lib/run');

function contextFingerprint(root, file, line, message) {
  const absolute = safePath(root, file);
  // Context rather than line number: inserted lines must not turn old findings new.
  const text = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8').split(/\r?\n/) : [];
  return hash(JSON.stringify([message, line ? (text[line - 1] ?? '').trim() : 'file-level']));
}
function projectFile(root, cwd, file) {
  const absolute = typeof file === 'string' && file ? path.resolve(cwd, file) : file;
  return path.relative(root, safePath(root, absolute)).split(path.sep).join('/');
}
function normalize(kind, data, root, cwd = root) {
  if (kind === 'semgrep') {
    if (!Array.isArray(data.results) || (data.errors ?? []).length) throw new Error('Incomplete Semgrep scan');
    return data.results.map(item => {
      const file = projectFile(root, cwd, item.path);
      const line = item.start?.line, message = item.extra?.message;
      if (!message || !line || !item.check_id) throw new Error('Invalid Semgrep diagnostic');
      return { file, line, rule: item.check_id, message, severity: item.extra.severity === 'ERROR' ? 'error' : item.extra.severity === 'WARNING' ? 'warning' : 'info', fingerprint: contextFingerprint(root, file, line, message) };
    });
  }
  if (kind === 'spectral') {
    if (!Array.isArray(data)) throw new Error('Invalid Spectral report');
    return data.map(item => {
      const file = projectFile(root, cwd, item.source);
      const line = item.range?.start?.line + 1;
      return { file, line, rule: String(item.code), message: item.message,
        severity: ['error', 'warning', 'info', 'info'][item.severity] ?? 'error',
        fingerprint: contextFingerprint(root, file, line, item.message) };
    });
  }
  if (kind === 'diagnostics') {
    if (data.complete !== true || !Array.isArray(data.diagnostics)) throw new Error('Complete diagnostic producer report required');
    return data.diagnostics.map(item => ({ ...item, file: projectFile(root, cwd, item.file) }));
  }
  throw new Error(`Unsupported diagnostic tool: ${kind}`);
}
function parseLcov(text, root, cwd = root) {
  const coverage = [];
  let record;
  for (const raw of text.split(/\r?\n/)) {
    if (raw.startsWith('SF:')) {
      if (record) throw new Error('Unterminated LCOV record');
      record = { file: projectFile(root, cwd, raw.slice(3)), lines: [], branches: [] };
    } else if (raw.startsWith('DA:') && record) {
      const [line, hits] = raw.slice(3).split(',').map(Number); record.lines.push({ line, hits });
    } else if (raw.startsWith('BRDA:') && record) {
      const [line, block, branch, taken] = raw.slice(5).split(',');
      record.branches.push({ line: Number(line), id: `${block}:${branch}`, hits: taken === '-' ? 0 : Number(taken) });
    } else if (raw === 'end_of_record') {
      if (!record) throw new Error('Invalid LCOV record');
      coverage.push(record); record = undefined;
    }
  }
  if (record || !coverage.length) throw new Error('Empty/incomplete LCOV report');
  for (const item of coverage) {
    if (!item.lines.length) throw new Error('LCOV contains no executable line counters');
    for (const counter of [...item.lines, ...item.branches])
      if (!Number.isInteger(counter.line) || counter.line < 1 || !Number.isFinite(counter.hits) || counter.hits < 0) throw new Error('Invalid LCOV counter');
  }
  return coverage;
}
function runCheck({ kind, command, env = process.env, runner = spawnSync }) {
  const cwd = process.cwd();
  const root = fs.realpathSync(env.SDD_ROOT || process.cwd());
  if (!env.SDD_RUN || !env.SDD_RUN_ID || !env.SDD_SCOPE_DIGEST || !env.SDD_PHASE) throw new Error('Run this check through the gate runner');
  if (!command.length) throw new Error('Tool command required after --');
  // Coverage producer must write to this unique path, via SDD_REPORT_PATH.
  const reportPath = path.join(env.SDD_RUN, 'evidence', `coverage-${crypto.randomUUID()}.lcov`);
  const result = runner(command[0], command.slice(1), { cwd, env: { ...env, SDD_REPORT_PATH: reportPath },
    encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 300000, shell: false });
  if (result.error || result.signal || ![0, 1].includes(result.status)) throw new Error(result.error?.message ?? `Tool failed (${result.status}): ${String(result.stderr).slice(-1500)}`);
  const provenance = { complete: true, runId: env.SDD_RUN_ID, scopeDigest: env.SDD_SCOPE_DIGEST, phase: env.SDD_PHASE };
  if (kind === 'lcov') {
    if (result.status !== 0) throw new Error('Tests/coverage command failed');
    const coverage = parseLcov(fs.readFileSync(reportPath, 'utf8'), root, cwd);
    return { ...provenance, coverage, source: 'fresh-local-lcov', report: reportPath };
  }
  const diagnostics = normalize(kind, JSON.parse(result.stdout), root, cwd);
  if (result.status !== 0 && !diagnostics.length) throw new Error('Failed tool without diagnostics');
  return { ...provenance, diagnostics, source: kind };
}
if (require.main === module) {
  try {
    const [option, separator, ...command] = process.argv.slice(2);
    if (!option?.startsWith('--kind=') || separator !== '--') throw new Error('Use --kind=semgrep|spectral|diagnostics|lcov -- command args');
    console.log(JSON.stringify(runCheck({ kind: option.slice(7), command })));
  } catch (error) {
    console.log(JSON.stringify({ toolStatus: 'BLOCKED', reason: error.message,
      runId: process.env.SDD_RUN_ID, scopeDigest: process.env.SDD_SCOPE_DIGEST, phase: process.env.SDD_PHASE }));
    process.exitCode = 1;
  }
}
module.exports = { normalize, parseLcov, runCheck, contextFingerprint };
