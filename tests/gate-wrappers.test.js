const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { fixture } = require('./helpers');
const { hash } = require('../scripts/lib/run');

const wrappers = [
  'g0-spec-lint.sh', 'g1-static-check.sh', 'g2-contract-test.sh',
  'g3-integration-test.sh', 'g4-test-and-security.sh', 'g5-metrics-summary.sh'
];
const invoke = (wrapper, args = [], options = {}) => spawnSync('bash', [
  path.join(__dirname, '../scripts/gates', wrapper), ...args
], { encoding: 'utf8', timeout: 15000, ...options });
const report = result => {
  assert.equal(result.error, undefined);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
};

for (const [index, wrapper] of wrappers.entries()) {
  test(`${wrapper}: absent, invalid and positional inputs are BLOCKED`, t => {
    const f = fixture(t);
    for (const args of [
      [],
      [`--run=${f.run.directory}`, '--phase=after'],
      [`--config=${f.configPath}`, '--phase=after'],
      ['--run=/__missing_sdd_run__', '--phase=after', `--config=${f.configPath}`],
      [f.root, '100', '0', '85', '82', 'OK'],
      [`--run=${f.run.directory}`, '--phase=invalid', '--config=missing.json']
    ]) {
      const result = invoke(wrapper, args, { cwd: f.root });
      const data = report(result);
      assert.equal(result.status, 1);
      assert.equal(data.status, 'BLOCKED');
      assert.notEqual(data.decision, 'RELEASE_APPROVED');
      assert.deepEqual(data.checks, []);
    }
    assert.equal(fs.readdirSync(path.join(f.run.directory, 'evidence')).length, 0);
  });

  test(`${wrapper}: duplicate --gate cannot override G${index}`, t => {
    const f = fixture(t);
    const args = [`--run=${f.run.directory}`, '--phase=after', `--config=${f.configPath}`];
    for (const attempt of [[...args, '--gate=G0'], ['--gate=G5', ...args]]) {
      const result = invoke(wrapper, attempt);
      const data = report(result);
      assert.equal(result.status, 1);
      assert.equal(data.status, 'BLOCKED');
      assert.match(data.gaps[0].message, /Invalid\/duplicate option/);
      assert.deepEqual(data.checks, []);
    }
    assert.equal(fs.readdirSync(path.join(f.run.directory, 'evidence')).length, 0);
  });
}

test('G0-G4 wrappers execute real configured checks and persist before/after artifacts; G5 needs reviews', t => {
  const f = fixture(t);
  const literal = 'space ; $(not-a-command) "quoted" *';
  const command = [process.execPath, '-e', `
    const assert = require('node:assert/strict');
    assert.equal(process.argv[1], ${JSON.stringify(literal)});
    console.log(JSON.stringify({ complete: true, diagnostics: [],
      runId: process.env.SDD_RUN_ID, scopeDigest: process.env.SDD_SCOPE_DIGEST,
      phase: process.env.SDD_PHASE }));
  `, literal];
  for (let i = 0; i < 5; i++) {
    f.config.gates[`G${i}`] = { applicable: true, checks: [{ id: 'real-check', format: 'json', command }] };
  }
  const configPath = path.join(f.root, 'checks with spaces.json');
  f.write('checks with spaces.json', f.config);
  for (const phase of ['before', 'after']) {
    if (phase === 'after') f.write('src/example.js', 'const old = 1;\nconst value = 2;\n');
    for (let i = 0; i < 5; i++) {
      const result = invoke(wrappers[i], [`--run=${f.run.directory}`, `--phase=${phase}`, `--config=${configPath}`], { cwd: f.root });
      const data = report(result);
      assert.equal(result.status, 0);
      assert.equal(data.status, 'PASS');
      assert.equal(data.gate, `G${i}`);
      assert.equal(data.phase, phase);
      assert.equal(data.runId, f.run.runId);
      assert.equal(data.configDigest, hash(JSON.stringify(f.config)));
      const artifact = path.join(f.run.directory, 'evidence', `G${i}.${phase}.json`);
      assert.equal(data.report, artifact);
      const saved = { ...data }; delete saved.report;
      assert.deepEqual(JSON.parse(fs.readFileSync(artifact, 'utf8')), saved);
      assert.equal(data.checks.length, 1);
      const check = data.checks[0];
      const logBytes = fs.readFileSync(check.evidence);
      assert.equal(check.evidenceDigest, hash(logBytes));
      const log = JSON.parse(logBytes);
      assert.deepEqual(log.command, command);
      assert.equal(log.cwd, fs.realpathSync(f.root));
      assert.equal(log.stderr, '');
      const output = JSON.parse(log.stdout);
      assert.equal(output.runId, data.runId);
      assert.equal(output.phase, phase);
      assert.equal(output.scopeDigest, data.scope.digest);
    }
  }
  const result = invoke(wrappers[5], [`--run=${f.run.directory}`, '--phase=after', `--config=${configPath}`]);
  const data = report(result);
  assert.equal(result.status, 1);
  assert.equal(data.gate, 'G5');
  assert.equal(data.status, 'BLOCKED');
  assert.equal(data.decision, 'NOT_APPROVED');
  assert.deepEqual(data.checks.map(c => c.id), ['G0', 'G1', 'G2', 'G3', 'G4']);
  assert.deepEqual(data.gaps.map(g => g.check), ['code-review-agent', 'quality-gate-evaluator']);
  assert.equal(JSON.parse(fs.readFileSync(data.report, 'utf8')).decision, 'NOT_APPROVED');
});

test('Sonar helper ignores stale coverage and delegates named options without approving G4', t => {
  const f = fixture(t);
  f.write('coverage/lcov.info', 'LF:0\nLH:0\nBRF:0\nBRH:0\n');
  f.write('coverage/coverage-summary.json', { total: { lines: { pct: 100 }, branches: { pct: 100 } } });
  const env = { ...process.env, SONAR_HOST_URL: '', SONAR_TOKEN: '', SDD_RUN: '' };
  for (const args of [[], ['--project=fixture'], [f.root, '80', '80'], ['--gate=G4']]) {
    const result = invoke('g4-sonarqube-analysis.sh', args, { cwd: f.root, env });
    const data = report(result);
    assert.equal(result.status, 1);
    assert.equal(data.toolStatus, 'BLOCKED');
    assert.equal(data.gate, undefined);
    assert.equal(data.metrics, undefined);
    assert.equal(data.status, undefined);
    assert.notEqual(data.decision, 'RELEASE_APPROVED');
  }
  assert.equal(fs.readdirSync(path.join(f.run.directory, 'evidence')).length, 0);
});

test('Prism helper validates named arguments and forwards literal paths, never gate approval', t => {
  const f = fixture(t);
  f.write('bin/prism', `#!${process.execPath}\nconsole.log(JSON.stringify(process.argv.slice(2)));\n`);
  fs.chmodSync(path.join(f.root, 'bin/prism'), 0o700);
  const spec = '-spec ; $(not-a-command) "quoted".yaml';
  f.write(spec, 'openapi: 3.0.0\n');
  const options = { cwd: f.root, env: { ...process.env, PATH: `${path.join(f.root, 'bin')}${path.delimiter}${process.env.PATH}` } };
  for (const args of [
    [], [spec, '4010'], [`--spec=${spec}`], ['--port=4010'],
    ['--spec=missing.yaml', '--port=4010'],
    [`--spec=${spec}`, `--spec=${spec}`, '--port=4010'],
    [`--spec=${spec}`, '--port=4010', '--port=4011'],
    [`--spec=${spec}`, '--port=4010', '--host=0.0.0.0'],
    ...['', '0', '65536', '04010', '-1', '1;exit 0', '999999999999999999999999'].map(port => [`--spec=${spec}`, `--port=${port}`])
  ]) {
    const result = invoke('g0-mock-server.sh', args, options);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /BLOCKED/);
  }
  const result = invoke('g0-mock-server.sh', [`--spec=${spec}`, '--port=4010'], options);
  assert.equal(result.status, 0);
  assert.deepEqual(report(result), ['mock', path.join(fs.realpathSync(f.root), spec), '--host=127.0.0.1', '--port=4010']);
  assert.equal(fs.readdirSync(path.join(f.run.directory, 'evidence')).length, 0);
});
