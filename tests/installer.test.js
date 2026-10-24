const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { deployHarnesses } = require('../bin/sdd');

const ROOT = path.resolve(__dirname, '..');
const INSTALL = path.join(ROOT, 'scripts/install.sh');
const roles = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'core/roles.json'), 'utf8')).roles);
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
function fixture(t) {
  const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-installer-')));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, 'isolated home');
  const project = path.join(temp, 'consumer project');
  fs.mkdirSync(home);
  fs.mkdirSync(project);
  return { temp, home, project };
}
function shell(f, args) {
  return spawnSync('bash', [INSTALL, ...args], {
    cwd: f.project,
    env: { ...process.env, HOME: f.home, USERPROFILE: f.home },
    encoding: 'utf8'
  });
}
function write(root, file, content) {
  const dest = path.join(root, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
}

test('TUI entry can be imported without prompts, commands or writes', () => {
  const result = spawnSync(process.execPath, ['-e', `
    require('node:child_process').execSync = () => { throw new Error('Unexpected command'); };
    const fs = require('node:fs');
    for (const method of ['writeFileSync', 'appendFileSync', 'cpSync', 'copyFileSync', 'mkdirSync', 'symlinkSync'])
      fs[method] = () => { throw new Error('Unexpected write: ' + method); };
    const { deployHarnesses } = require(${JSON.stringify(path.join(ROOT, 'bin/sdd.js'))});
    if (typeof deployHarnesses !== 'function') throw new Error('Missing export');
  `], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});

for (const entry of ['shell', 'TUI']) {
  test(`${entry} project/all preserves configs, compiles roles and rejects customized agents`, t => {
    const f = fixture(t);
    const configs = {
      'opencode.jsonc': '// user config\n{"model":"user/model"}',
      'CLAUDE.md': 'User instructions\n',
      '.cursor/mcp.json': '{"user":true}',
      '.agents/mcp_config.json': '{"user":true}',
      '.cursorrules': 'User cursor rules',
      '.windsurfrules': 'User windsurf rules'
    };
    for (const [file, content] of Object.entries(configs)) write(f.project, file, content);
    const install = () => entry === 'shell'
      ? shell(f, [`--target=${f.project}`, '--harnesses=all', '--global=false'])
      : deployHarnesses(['all'], false, f.project);
    const result = install();
    const deployment = entry === 'shell' ? (assert.equal(result.status, 0, result.stderr), JSON.parse(result.stdout)) : result;
    assert.deepEqual(deployment.harnesses, ['opencode', 'claude', 'cursor', 'windsurf', 'antigravity']);
    for (const [file, content] of Object.entries(configs)) assert.equal(read(f.project, file), content);
    assert.ok(fs.existsSync(path.join(f.project, '.opencode/sdd.config.json')));
    assert.ok(fs.existsSync(path.join(f.project, '.claude/SDD.md')));
    for (const dir of ['.opencode/agents', '.claude/agents', '.agents/agents']) {
      assert.deepEqual(fs.readdirSync(path.join(f.project, dir)).sort(), roles.map(role => `${role}.md`).sort());
      assert.match(read(f.project, `${dir}/orchestrator.md`), /^---\n/);
    }
    for (const file of ['.cursor/rules/00-quality-gates.mdc', '.windsurf/rules/sdd.md', '.sdd/scripts/gate.js', '.sdd/core/stacks/typescript/guidelines.md'])
      assert.ok(fs.existsSync(path.join(f.project, file)), file);
    assert.equal(fs.existsSync(path.join(f.project, 'scripts/gates')), false);
    assert.equal(fs.existsSync(path.join(f.project, 'tools')), false);
    assert.deepEqual(fs.readdirSync(f.home), []);
    const manifest = read(f.project, '.sdd/install-manifest.json');
    const repeated = install();
    if (entry === 'shell') assert.equal(repeated.status, 0, repeated.stderr);
    assert.equal(read(f.project, '.sdd/install-manifest.json'), manifest);
    write(f.project, '.opencode/agents/frontend-agent.md', 'Customized agent');
    if (entry === 'shell') {
      const conflict = install();
      assert.equal(conflict.status, 1);
      assert.match(conflict.stderr, /Preserving customized file/);
    } else assert.throws(install, /Preserving customized file/);
    assert.equal(read(f.project, '.opencode/agents/frontend-agent.md'), 'Customized agent');
    assert.equal(read(f.project, '.sdd/install-manifest.json'), manifest);
  });

  test(`${entry} global/all uses only the explicit temporary target and global resources`, t => {
    const f = fixture(t);
    const target = path.join(f.temp, 'global target');
    fs.mkdirSync(target);
    write(target, '.config/opencode/opencode.jsonc', '// preserved\n{}');
    write(target, '.claude/CLAUDE.md', 'Global user instructions');
    const install = () => entry === 'shell'
      ? shell(f, [`--target=${target}`, '--harnesses=all', '--global=true'])
      : deployHarnesses(['all'], true, target);
    const result = install();
    if (entry === 'shell') assert.equal(result.status, 0, result.stderr);
    assert.equal(read(target, '.config/opencode/opencode.jsonc'), '// preserved\n{}');
    assert.equal(read(target, '.claude/CLAUDE.md'), 'Global user instructions');
    assert.ok(fs.existsSync(path.join(target, '.claude/SDD.md')));
    const config = JSON.parse(read(target, '.config/opencode/sdd.config.json'));
    assert.deepEqual(config.skills.paths, [path.join(target, '.sdd/global/core/skills')]);
    assert.ok(read(target, '.config/opencode/agents/orchestrator.md').includes(`${target}/.sdd/global/core/`));
    assert.equal(fs.existsSync(path.join(target, '.sdd/install-manifest.json')), false);
    assert.equal(fs.existsSync(path.join(target, 'opencode.json')), false);
    assert.equal(fs.existsSync(path.join(target, 'CLAUDE.md')), false);
    assert.equal(fs.existsSync(path.join(target, 'scripts/gates')), false);
    const manifest = read(target, '.sdd/global/install-manifest.json');
    const repeated = install();
    if (entry === 'shell') assert.equal(repeated.status, 0, repeated.stderr);
    assert.equal(read(target, '.sdd/global/install-manifest.json'), manifest);
    assert.deepEqual(fs.readdirSync(f.home), []);
    assert.deepEqual(fs.readdirSync(f.project), []);
  });
}

test('shell help and invalid named or positional arguments never install anything', t => {
  const f = fixture(t);
  const help = shell(f, ['--help']);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--target=DIR.*--harnesses=LIST.*--global=true\|false/);
  for (const args of [['all', 'symlink'], ['--global=yes'], ['--harnesses=unknown'], ['--target=x', '--target=y'], ['--unknown=true']]) {
    const result = shell(f, args);
    assert.equal(result.status, 1, JSON.stringify(args));
    assert.match(result.stderr, /BLOCKED/);
  }
  assert.deepEqual(fs.readdirSync(f.home), []);
  assert.deepEqual(fs.readdirSync(f.project), []);
});

test('shell defaults to project/OpenCode and uses only isolated home for default global target', t => {
  const f = fixture(t);
  const project = shell(f, []);
  assert.equal(project.status, 0, project.stderr);
  assert.deepEqual(JSON.parse(project.stdout).harnesses, ['opencode']);
  assert.ok(fs.existsSync(path.join(f.project, 'opencode.json')));
  assert.equal(fs.existsSync(path.join(f.project, '.claude')), false);
  assert.deepEqual(fs.readdirSync(f.home), []);
  const manifest = read(f.project, '.sdd/install-manifest.json');
  const global = shell(f, ['--global=true']);
  assert.equal(global.status, 0, global.stderr);
  assert.equal(JSON.parse(global.stdout).target, f.home);
  assert.ok(fs.existsSync(path.join(f.home, '.sdd/global/install-manifest.json')));
  assert.ok(fs.existsSync(path.join(f.home, '.config/opencode/opencode.json')));
  assert.equal(read(f.project, '.sdd/install-manifest.json'), manifest);
});

test('shell refuses symlink destinations without touching their target', t => {
  const f = fixture(t);
  fs.symlinkSync(f.home, path.join(f.project, '.opencode'));
  const result = shell(f, [`--target=${f.project}`, '--harnesses=opencode']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Symlink path rejected/);
  assert.deepEqual(fs.readdirSync(f.home), []);
  assert.equal(fs.existsSync(path.join(f.project, '.sdd')), false);
});

for (const [stack, coverage] of [
  ['typescript', 'sonar.javascript.lcov.reportPaths=coverage/lcov.info'],
  ['python', 'sonar.python.coverage.reportPaths=coverage.xml'],
  ['go', 'sonar.go.coverage.reportPaths=coverage.out'],
  ['java', 'sonar.coverageReportPaths=target/site/jacoco/jacoco.xml'],
  ['agnostic', 'sonar.sources=.']
]) {
  test(`Sonar ${stack} property generation never persists or prints the process token`, t => {
    const f = fixture(t);
    const secret = 'sonar-test-secret-do-not-persist';
    write(f.project, 'sonar-project.properties', 'sonar.token=obsolete\nsonar.login=obsolete\n');
    if (stack !== 'agnostic') write(f.project, '.env', 'USER_SETTING=preserved\n');
    const result = spawnSync(process.execPath, ['-e', `
      require('node:child_process').execSync = () => { throw new Error('Unexpected command'); };
      global.fetch = () => { throw new Error('Unexpected network request'); };
      const assert = require('node:assert/strict');
      const { configureSonarProperties } = require(${JSON.stringify(path.join(ROOT, 'bin/sdd.js'))});
      const config = { enabled: true, hostUrl: 'https://sonar.example.test', projectKey: 'old', projectName: 'Old' };
      const prompts = {
        confirm: async () => true,
        text: async ({ message }) => {
          if (message === 'Project Key en SonarQube:') return 'consumer-key';
          if (message === 'Project Name en SonarQube:') return 'Consumer Name';
          throw new Error('Unexpected credential prompt');
        }
      };
      (async () => {
        await configureSonarProperties(process.cwd(), { id: ${JSON.stringify(stack)} }, config, prompts);
        assert.equal(config.projectKey, 'consumer-key');
        assert.equal(config.projectName, 'Consumer Name');
        assert.equal(Object.hasOwn(config, 'token'), false);
        await configureSonarProperties(process.cwd(), { id: ${JSON.stringify(stack)} }, config, prompts);
        console.log(JSON.stringify(config));
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `], {
      cwd: f.project,
      env: { ...process.env, HOME: f.home, USERPROFILE: f.home, SONAR_TOKEN: secret },
      encoding: 'utf8', timeout: 10000
    });
    assert.equal(result.stdout.includes(secret), false, 'Token leaked to stdout');
    assert.equal(result.stderr.includes(secret), false, 'Token leaked to stderr');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /export SONAR_TOKEN/);
    const properties = read(f.project, 'sonar-project.properties');
    assert.ok(properties.includes(coverage));
    assert.match(properties, /^sonar.projectKey=consumer-key$/m);
    assert.match(properties, /^sonar.projectName=Consumer Name$/m);
    assert.match(properties, /^sonar.host.url=https:\/\/sonar.example.test$/m);
    assert.doesNotMatch(properties, /sonar\.(token|login)\s*=/);
    for (const file of fs.readdirSync(f.project)) assert.equal(read(f.project, file).includes(secret), false);
    if (stack === 'agnostic') assert.equal(fs.existsSync(path.join(f.project, '.env')), false);
    else assert.equal(read(f.project, '.env'), 'USER_SETTING=preserved\n\nSONAR_HOST_URL=https://sonar.example.test\n');
    assert.deepEqual(fs.readdirSync(f.home), []);
  });
}

test('Sonar generation without a token preserves existing URL and reports write failures without credentials', t => {
  const f = fixture(t);
  write(f.project, '.env', 'SONAR_HOST_URL=https://existing.example.test\n');
  const result = spawnSync(process.execPath, ['-e', `
    const fs = require('node:fs');
    const { configureSonarProperties } = require(${JSON.stringify(path.join(ROOT, 'bin/sdd.js'))});
    const config = { enabled: true, hostUrl: 'https://sonar.example.test', projectKey: 'key', projectName: 'Name' };
    const prompts = { confirm: async () => true, text: async ({ initialValue }) => initialValue };
    (async () => {
      delete process.env.SONAR_TOKEN;
      await configureSonarProperties(process.cwd(), { id: 'typescript' }, config, prompts);
      fs.unlinkSync('sonar-project.properties');
      fs.mkdirSync('sonar-project.properties');
      process.env.SONAR_TOKEN = 'sonar-failure-secret-do-not-print';
      await configureSonarProperties(process.cwd(), { id: 'typescript' }, config, prompts);
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `], {
    cwd: f.project, env: { ...process.env, HOME: f.home, USERPROFILE: f.home },
    encoding: 'utf8', timeout: 10000
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /EISDIR/);
  assert.equal(result.stdout.includes('sonar-failure-secret-do-not-print'), false);
  assert.equal(result.stderr.includes('sonar-failure-secret-do-not-print'), false);
  assert.equal(read(f.project, '.env'), 'SONAR_HOST_URL=https://existing.example.test\n');
  assert.deepEqual(fs.readdirSync(f.home), []);
});
