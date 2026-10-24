const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseLcov, normalize, runCheck, contextFingerprint } = require('../scripts/check');
const { fixture } = require('./helpers');
const { sonarCheck } = require('../scripts/sonar-check');
const { capture } = require('../scripts/baseline');
const { executeGate } = require('../scripts/lib/gates');

test('LCOV accepts real counters and rejects empty/incomplete data', t => {
  const f = fixture(t);
  assert.throws(() => parseLcov('', f.root), /Empty/);
  assert.throws(() => parseLcov('SF:src/example.js\nDA:1,1', f.root), /incomplete/);
  assert.throws(() => parseLcov('SF:src/example.js\nend_of_record\n', f.root), /no executable/);
  assert.throws(() => parseLcov('SF:src/example.js\nDA:1,nope\nend_of_record\n', f.root), /Invalid/);
  const data = parseLcov('SF:src/example.js\nDA:1,1\nBRDA:1,0,0,-\nend_of_record\n', f.root);
  assert.equal(data[0].branches[0].hits, 0);
});
test('Semgrep parser refuses incomplete scans and normalizes context', t => {
  const f = fixture(t);
  assert.throws(() => normalize('semgrep', { results: [], errors: [{ message: 'parse failed' }] }, f.root), /Incomplete/);
  const result = normalize('semgrep', { results: [{ path: 'src/example.js', start: { line: 1 }, check_id: 'x', extra: { message: 'issue', severity: 'ERROR' } }] }, f.root);
  assert.equal(result[0].severity, 'error'); assert.match(result[0].fingerprint, /^[a-f0-9]{64}$/);
});
test('coverage requires a fresh report path produced by successful tests', t => {
  const f = fixture(t);
  const env = { SDD_RUN: f.run.directory, SDD_ROOT: f.root, SDD_RUN_ID: f.run.runId, SDD_SCOPE_DIGEST: 'digest', SDD_PHASE: 'after' };
  assert.throws(() => runCheck({ kind: 'lcov', command: ['tests'], env, runner: () => ({ status: 0 }) }), /ENOENT/);
  const result = runCheck({ kind: 'lcov', command: ['tests'], env, runner: (_e, _a, options) => {
    fs.writeFileSync(options.env.SDD_REPORT_PATH, `SF:${path.join(fs.realpathSync(f.root), 'src/example.js')}\nDA:1,1\nend_of_record\n`); return { status: 0 };
  } });
  assert.equal(result.source, 'fresh-local-lcov');
});
test('injected producers retain the invocation cwd and normalize paths without losing identity', t => {
  const f = fixture(t);
  f.write('packages/api/src/example.js', 'nested context\n');
  const cwd = fs.realpathSync(path.join(f.root, 'packages/api'));
  const previous = process.cwd();
  const env = { SDD_RUN: f.run.directory, SDD_ROOT: f.root, SDD_RUN_ID: f.run.runId, SDD_SCOPE_DIGEST: 'digest', SDD_PHASE: 'after' };
  const diagnostic = { file: 'src/example.js', line: 1, rule: 'rule', message: 'issue', severity: 'warning', fingerprint: 'producer-context', attribution: 'preserved' };
  const reports = new Set();
  process.chdir(cwd);
  try {
    for (const kind of ['diagnostics', 'semgrep', 'spectral', 'lcov']) {
      const result = runCheck({ kind, command: ['producer', '--json'], env, runner: (exe, args, options) => {
        assert.equal(exe, 'producer'); assert.deepEqual(args, ['--json']);
        assert.equal(options.cwd, cwd);
        assert.equal(options.env.SDD_ROOT, f.root);
        assert.equal(path.dirname(options.env.SDD_REPORT_PATH), path.join(f.run.directory, 'evidence'));
        assert.equal(reports.has(options.env.SDD_REPORT_PATH), false);
        reports.add(options.env.SDD_REPORT_PATH);
        if (kind === 'lcov') {
          fs.writeFileSync(options.env.SDD_REPORT_PATH, 'SF:src/example.js\nDA:1,1\nend_of_record\n');
          return { status: 0 };
        }
        const data = kind === 'diagnostics' ? { complete: true, diagnostics: [diagnostic] } : kind === 'semgrep' ?
          { results: [{ path: 'src/example.js', start: { line: 1 }, check_id: 'rule', extra: { message: 'issue', severity: 'WARNING' } }] } :
          [{ source: 'src/example.js', range: { start: { line: 0 } }, code: 'rule', message: 'issue', severity: 1 }];
        return { status: 1, stdout: JSON.stringify(data) };
      } });
      assert.equal(result.complete, true);
      assert.equal(result.runId, env.SDD_RUN_ID);
      assert.equal(result.scopeDigest, env.SDD_SCOPE_DIGEST);
      assert.equal(result.phase, env.SDD_PHASE);
      assert.equal((result.coverage ?? result.diagnostics)[0].file, 'packages/api/src/example.js');
      if (kind === 'diagnostics') assert.deepEqual(result.diagnostics[0], { ...diagnostic, file: 'packages/api/src/example.js' });
      if (kind === 'semgrep' || kind === 'spectral') {
        assert.equal(result.diagnostics[0].fingerprint, contextFingerprint(f.root, 'packages/api/src/example.js', 1, 'issue'));
      }
      if (kind === 'lcov') {
        assert.equal(result.source, 'fresh-local-lcov');
        assert.ok(reports.has(result.report));
      }
    }
  } finally { process.chdir(previous); }
});
for (const kind of ['diagnostics', 'semgrep', 'spectral', 'lcov']) {
  test(`real monorepo gate preserves nested cwd and root-relative ${kind} evidence`, t => {
    const f = fixture(t);
    const file = 'packages/api/src/example.js';
    f.write(file, 'old context\n');
    const run = capture({ root: f.root, files: [file, 'src/example.js'], tempParent: f.temp });
    const producer = `
      const fs = require('node:fs');
      const text = fs.readFileSync('src/example.js', 'utf8');
      if (!text.includes('old context')) throw new Error('Wrong producer cwd');
      const line = text.startsWith('inserted') ? 2 : 1;
      const kind = ${JSON.stringify(kind)};
      if (kind === 'lcov') {
        fs.writeFileSync(process.env.SDD_REPORT_PATH,
          'SF:src/example.js\\nDA:1,1\\nDA:2,1\\nend_of_record\\nSF:../../src/example.js\\nDA:1,1\\nend_of_record\\n');
      } else {
        const data = kind === 'diagnostics' ? { complete: true, diagnostics: [
          { file: 'src/example.js', line, rule: 'legacy', message: 'issue', severity: 'error', fingerprint: 'stable-context' }
        ] } : kind === 'semgrep' ? { results: [
          { path: 'src/example.js', start: { line }, check_id: 'legacy', extra: { message: 'issue', severity: 'ERROR' } }
        ] } : [{ source: 'src/example.js', range: { start: { line: line - 1 } }, code: 'legacy', message: 'issue', severity: 0 }];
        process.stdout.write(JSON.stringify(data));
        process.exitCode = 1;
      }
    `;
    const check = { id: kind, cwd: 'packages/api', format: kind === 'lcov' ? 'coverage' : 'json',
      command: [process.execPath, path.join(__dirname, '../scripts/check.js'), `--kind=${kind}`, '--', process.execPath, '-e', producer] };
    if (kind === 'lcov') Object.assign(check, { files: [file, 'src/example.js'], lineThreshold: 100, branchThreshold: 100 });
    f.config.gates.G1 = { applicable: true, checks: [check] }; f.saveConfig();
    const execute = phase => executeGate({ directory: run.directory, configPath: f.configPath, gate: 'G1', phase });
    const before = execute('before');
    assert.equal(before.status, kind === 'lcov' ? 'PASS' : 'FAIL', JSON.stringify(before.gaps));
    f.write(file, 'inserted\nold context\n');
    const after = execute('after');
    assert.equal(after.status, 'PASS', JSON.stringify(after.gaps));
    assert.equal(after.baseline.manifest, path.join(run.directory, 'baseline.json'));
    assert.equal(JSON.parse(fs.readFileSync(after.baseline.manifest)).root, fs.realpathSync(f.root));
    assert.equal(after.findings.length, 0);
    assert.equal(after.checks[0].cwd, path.join(fs.realpathSync(f.root), 'packages/api'));
    const log = JSON.parse(fs.readFileSync(after.checks[0].evidence, 'utf8'));
    const report = JSON.parse(log.stdout);
    assert.equal(report.runId, run.runId);
    assert.equal(report.scopeDigest, after.scope.digest);
    assert.equal(report.phase, 'after');
    assert.equal(report.complete, true);
    if (kind === 'lcov') {
      assert.deepEqual(report.coverage.map(item => item.file), [file, 'src/example.js']);
      assert.equal(path.dirname(report.report), path.join(run.directory, 'evidence'));
      assert.ok(fs.existsSync(report.report));
      assert.notEqual(report.report, JSON.parse(JSON.parse(fs.readFileSync(before.checks[0].evidence, 'utf8')).stdout).report);
      assert.equal(after.checks[0].metrics.lineCoverage, 100);
    } else {
      assert.equal(after.debt.length, 1);
      assert.equal(after.debt[0].file, file);
      assert.equal(after.debt[0].line, 2);
      assert.equal(after.debt[0].fingerprint, before.findings[0].fingerprint);
    }
  });
}
test('producer paths allow in-root parents and absolute files but reject escapes and symlinks', t => {
  const f = fixture(t);
  f.write('packages/api/src/example.js', 'nested context\n');
  const cwd = path.join(f.root, 'packages/api');
  fs.symlinkSync(path.join(f.root, 'src'), path.join(cwd, 'linked'));
  const parsers = [
    file => normalize('diagnostics', { complete: true, diagnostics: [{ file, fingerprint: 'identity' }] }, f.root, cwd),
    file => normalize('semgrep', { results: [{ path: file, start: { line: 1 }, check_id: 'rule', extra: { message: 'issue' } }] }, f.root, cwd),
    file => normalize('spectral', [{ source: file, range: { start: { line: 0 } }, code: 'rule', message: 'issue' }], f.root, cwd),
    file => parseLcov(`SF:${file}\nDA:1,1\nend_of_record\n`, f.root, cwd)
  ];
  for (const parse of parsers) {
    assert.equal(parse('../../src/example.js')[0].file, 'src/example.js');
    assert.equal(parse(path.join(f.root, 'src/example.js'))[0].file, 'src/example.js');
    assert.throws(() => parse('../../../outside.js'), /escapes root/);
    assert.throws(() => parse(path.join(f.temp, 'outside.js')), /escapes root/);
    assert.throws(() => parse('linked/example.js'), /Symlink path rejected/);
    assert.throws(() => parse(''), /Invalid file path/);
    assert.throws(() => parse('src/invalid\0.js'), /Invalid file path/);
  }
});
test('Sonar issue evidence uses completed fresh analysis and ignores historical global gate', async t => {
  const f = fixture(t);
  const env = { SDD_RUN: f.run.directory, SDD_ROOT: f.root, SDD_RUN_ID: f.run.runId, SDD_SCOPE_DIGEST: 'digest', SDD_PHASE: 'before', SONAR_HOST_URL: 'https://sonar.example', SONAR_TOKEN: 'test-token' };
  const runner = (_e, args) => {
    assert.ok(args.includes('-Dsonar.qualitygate.wait=false'));
    const file = args.find(a => a.startsWith('-Dsonar.scanner.metadataFilePath=')).split('=').slice(1).join('=');
    fs.writeFileSync(file, 'projectKey=project\nceTaskId=task\n'); return { status: 0 };
  };
  const fetcher = async url => ({ ok: true, json: async () => {
    if (url.pathname.endsWith('/ce/task')) return { task: { status: 'SUCCESS', analysisId: 'analysis' } };
    if (url.pathname.endsWith('/issues/search')) return { paging: { total: 1 }, issues: [{ key: 'issue', component: 'project:src/example.js', rule: 'rule', message: 'old issue', severity: 'MAJOR', line: 1 }] };
    if (url.pathname.endsWith('/project_analyses/search')) return { analyses: [{ key: 'analysis' }] };
    throw new Error('Unexpected API endpoint');
  } });
  const result = await sonarCheck({ project: 'project', runner, fetcher, env });
  assert.equal(result.diagnostics.length, 1); assert.equal(result.analysisId, 'analysis');
  await assert.rejects(() => sonarCheck({ project: 'project', runner, env, fetcher: async url => url.pathname.endsWith('/project_analyses/search') ? { ok: true, json: async () => ({ analyses: [{ key: 'other-analysis' }] }) } : fetcher(url) }), /Concurrent/);
});
