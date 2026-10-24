const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { executeGate, release, recordReview, coverageMetrics } = require('../scripts/lib/gates');
const { session } = require('../scripts/sessions');
const { fixture, finding, jsonRunner } = require('./helpers');

function setup(t, format = 'json') {
  const f = fixture(t);
  f.config.gates.G1 = { applicable: true, checks: [{ id: 'static', format, command: ['test-tool'] }] };
  f.saveConfig();
  return { ...f, execute: (options = {}) => executeGate({ directory: f.run.directory, configPath: f.configPath, gate: 'G1', ...options }) };
}
test('old diagnostics are debt; new, duplicate and aggravated findings fail', t => {
  const f = setup(t);
  assert.equal(f.execute({ phase: 'before', runner: jsonRunner([finding]) }).status, 'FAIL');
  f.write('src/example.js', 'const old = 1;\nconst value = 2;\n');
  const unchanged = f.execute({ runner: jsonRunner([{ ...finding, line: 2 }]) });
  assert.equal(unchanged.status, 'PASS'); assert.equal(unchanged.debt.length, 1);
  assert.equal(f.execute({ runner: jsonRunner([finding, finding]) }).status, 'FAIL');
  assert.equal(f.execute({ runner: jsonRunner([{ ...finding, severity: 'critical' }]) }).status, 'FAIL');
  assert.equal(f.execute({ runner: jsonRunner([{ ...finding, fingerprint: 'changed-context' }]) }).status, 'FAIL');
});
test('new diagnostics in untouched consumers block rather than being filtered out', t => {
  const f = setup(t);
  f.execute({ phase: 'before', runner: jsonRunner([finding]) });
  const result = f.execute({ runner: jsonRunner([finding, { ...finding, file: 'consumer.js', fingerprint: 'consumer-break' }]) });
  assert.equal(result.status, 'FAIL');
});
test('unclassified failures, absent tools and stale provenance are BLOCKED', t => {
  const f = setup(t, 'exit-code');
  assert.equal(f.execute({ runner: () => ({ status: 1, stdout: 'Old or new failure?' }) }).status, 'BLOCKED');
  assert.equal(f.execute({ runner: () => ({ status: null, error: new Error('ENOENT') }) }).status, 'BLOCKED');
  f.config.gates.G1.checks[0].format = 'json'; f.saveConfig();
  assert.equal(f.execute({ runner: () => ({ status: 0, stdout: '{"complete":true,"diagnostics":[]}' }) }).status, 'BLOCKED');
  assert.equal(f.execute({ runner: jsonRunner([finding]) }).status, 'BLOCKED');
});
test('before capture after writes and mutated validation inputs cannot pass', t => {
  const f = setup(t, 'exit-code');
  f.write('src/example.js', 'changed');
  assert.throws(() => f.execute({ phase: 'before' }), /before any scoped edits/);
  const result = f.execute({ runner: () => { f.write('src/example.js', 'changed again'); return { status: 0 }; } });
  assert.equal(result.status, 'BLOCKED'); assert.match(result.gaps[0].message, /mutated/);
});
test('invalid configuration fails before any command and empty gates cannot pass', t => {
  const f = setup(t);
  let called = false;
  f.config.gates.G1.checks = []; f.saveConfig();
  assert.throws(() => f.execute({ runner: () => { called = true; } }), /checks required/);
  assert.equal(called, false);
  f.config.gates.G1 = { applicable: false }; f.saveConfig();
  assert.throws(() => f.execute(), /reason/);
});
test('coverage considers changed lines, reports zero branches as null and blocks missing coverage', t => {
  const f = fixture(t);
  const check = { files: ['src/example.js'] };
  const changes = [{ file: 'src/example.js', kind: 'modified', lines: [2] }];
  const data = { complete: true, coverage: [{ file: 'src/example.js', lines: [{ line: 1, hits: 0 }, { line: 2, hits: 1 }], branches: [] }] };
  const metrics = coverageMetrics(data, check, changes, f.root);
  assert.equal(metrics.lineCoverage, 100); assert.equal(metrics.branchCoverage, null);
  assert.throws(() => coverageMetrics({ complete: true, coverage: [] }, check, changes, f.root), /Missing/);
});
test('G5 rejects missing/stale evidence and requires independent registered reviews', t => {
  const f = setup(t, 'exit-code');
  const releaseInput = { directory: f.run.directory, configPath: f.configPath };
  assert.equal(release(releaseInput).decision, 'NOT_APPROVED');
  for (const gate of ['G0', 'G1', 'G2', 'G3', 'G4']) executeGate({ ...releaseInput, gate, runner: () => ({ status: 0 }) });
  const review = { directory: f.run.directory, harness: 'opencode', parent: 'p', verdict: 'APPROVED', reason: 'Reviewed active acceptance and actual evidence',
    findings: [], acceptance: ['AC-01'], evidence: ['G0', 'G1', 'G2', 'G3', 'G4'].map(g => `evidence/${g}.after.json`) };
  assert.throws(() => recordReview({ ...review, role: 'code-review-agent', sessionId: 'not-registered' }));
  for (const role of ['code-review-agent', 'quality-gate-evaluator']) {
    session({ directory: f.run.directory, harness: 'opencode', parent: 'p', role, id: role });
    recordReview({ ...review, role, sessionId: role });
  }
  assert.equal(release(releaseInput).decision, 'RELEASE_APPROVED');
  f.execute({ runner: () => ({ status: 0 }) });
  assert.equal(release(releaseInput).decision, 'NOT_APPROVED', 'changed evidence requires resume review');
  f.write('src/example.js', 'new change');
  assert.equal(release(releaseInput).decision, 'NOT_APPROVED', 'stale source cannot release');
});
test('real subprocess logs evidence and timeout is not approval', t => {
  const f = setup(t, 'exit-code');
  f.config.gates.G1.checks[0].command = [process.execPath, '-e', 'process.stdout.write("ok")']; f.saveConfig();
  const result = f.execute();
  assert.equal(result.status, 'PASS');
  assert.equal(JSON.parse(fs.readFileSync(result.checks[0].evidence, 'utf8')).stdout, 'ok');
  f.config.gates.G1.checks[0].command = [process.execPath, '-e', 'setTimeout(()=>{},10000)'];
  f.config.gates.G1.checks[0].timeoutMs = 30; f.saveConfig();
  assert.equal(f.execute().status, 'BLOCKED');
});
test('CLI invalid destination returns the common BLOCKED envelope, never historical false PASS', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, '../scripts/gate.js'), '--gate=G1', '--run=/__missing_sdd_run__', '--config=missing.json'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'BLOCKED'); assert.equal(report.version, 1);
  assert.deepEqual(report.checks, []); assert.equal(report.scope, null);
});
test('changed-line coverage fails thresholds without including old uncovered lines', t => {
  const f = setup(t, 'coverage');
  Object.assign(f.config.gates.G1.checks[0], { files: ['src/example.js'], lineThreshold: 80, branchThreshold: 80 }); f.saveConfig();
  f.write('src/example.js', 'const old = 1;\nconst value = 2;\n');
  const runner = hits => (_e, _a, options) => ({ status: 0, stdout: JSON.stringify({ complete: true,
    runId: options.env.SDD_RUN_ID, scopeDigest: options.env.SDD_SCOPE_DIGEST, phase: options.env.SDD_PHASE,
    coverage: [{ file: 'src/example.js', lines: [{ line: 1, hits: 0 }, { line: 2, hits }], branches: [] }] }) });
  assert.equal(f.execute({ runner: runner(0) }).status, 'FAIL');
  assert.equal(f.execute({ runner: runner(1) }).status, 'PASS');
});
test('changed baseline command logs cannot grandfather diagnostics', t => {
  const f = setup(t);
  const before = f.execute({ phase: 'before', runner: jsonRunner([finding]) });
  fs.writeFileSync(before.checks[0].evidence, 'tampered command output');
  assert.equal(f.execute({ runner: jsonRunner([finding]) }).status, 'BLOCKED');
});
test('G5 rejects changed command logs even if gate summaries and review inputs are untouched', t => {
  const f = setup(t, 'exit-code');
  const input = { directory: f.run.directory, configPath: f.configPath };
  for (const gate of ['G0', 'G1', 'G2', 'G3', 'G4']) executeGate({ ...input, gate, runner: () => ({ status: 0 }) });
  const gate = JSON.parse(fs.readFileSync(path.join(f.run.directory, 'evidence/G1.after.json')));
  fs.writeFileSync(gate.checks[0].evidence, '{}');
  assert.ok(release(input).gaps.some(g => g.check === 'G1' && /command log/.test(g.message)));
});
