const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { compile, openCodePermissions } = require('../scripts/sync');
const { deploy } = require('../scripts/deploy');
const { fixture: baseFixture } = require('./helpers');
function fixture(t) {
  const f = baseFixture(t);
  return { ...f, temp: fs.realpathSync(f.temp), root: fs.realpathSync(f.root) };
}
const ROOT = path.resolve(__dirname, '..');
const registry = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'core/roles.json'), 'utf8')).roles;
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');

test('importing compiler and deploy has no filesystem, environment or console effects', () => {
  const child = spawnSync(process.execPath, ['-e', `
    const fs = require('node:fs');
    require(${JSON.stringify(path.join(ROOT, 'scripts/lib/run'))});
    const original = fs.readFileSync;
    fs.readFileSync = function(file, ...args) {
      if (String(file).endsWith('.env') || String(file).endsWith('roles.json')) throw new Error('Import read configuration');
      return original.call(this, file, ...args);
    };
    for (const method of ['writeFileSync', 'mkdirSync', 'renameSync', 'rmSync', 'appendFileSync', 'mkdtempSync'])
      fs[method] = () => { throw new Error('Import wrote files: ' + method); };
    process.env = new Proxy(process.env, {
      ownKeys() { throw new Error('Import copied environment'); },
      get(target, key) { if (key === 'N8N_MCP_TOKEN') throw new Error('Import read secret'); return target[key]; }
    });
    console.log = () => { throw new Error('Import logged output'); };
    const compiler = require(${JSON.stringify(path.join(ROOT, 'scripts/sync'))});
    if (typeof compiler.compile !== 'function' || typeof compiler.openCodePermissions !== 'function') throw new Error('Missing exports');
    require(${JSON.stringify(path.join(ROOT, 'scripts/deploy'))});
  `], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, '');
});

test('native adapters enforce canonical read/write/delegation separation', t => {
  const f = fixture(t), dest = path.join(f.temp, 'adapters');
  const roles = registry();
  compile(dest);
  assert.equal(Object.keys(roles).length, 13);
  assert.equal(roles['software-architect-orchestrator'], undefined);
  for (const [name, role] of Object.entries(roles)) {
    const permission = openCodePermissions(role);
    assert.equal(permission['*'], 'deny');
    assert.equal(permission.external_directory, 'ask');
    assert.equal(permission.webfetch, 'allow');
    assert.equal(permission['n8n-mcp_*'], undefined);
    if (role.kind === 'reader') { assert.equal(permission.edit, undefined); assert.equal(permission.bash, undefined); assert.equal(permission.task, undefined); }
    if (role.kind === 'writer') { assert.equal(permission.bash, undefined); assert.equal(permission.task, undefined); }
    const claude = read(dest, `claude-code/agents/${name}.md`);
    assert.match(claude, /disallowedTools:/);
    const tools = JSON.parse(claude.match(/^tools: (.+)$/m)[1]);
    const disallowed = JSON.parse(claude.match(/^disallowedTools: (.+)$/m)[1]);
    assert.ok(tools.includes('Read') && tools.includes('WebFetch') && tools.includes('Skill'));
    assert.equal(tools.some(tool => /mcp/i.test(tool)), false);
    if (role.kind === 'reader') assert.ok(['Edit', 'Write', 'Bash', 'Agent', 'Task'].every(tool => disallowed.includes(tool)));
    if (role.kind === 'writer') assert.ok(['Edit', 'Write'].every(tool => tools.includes(tool)) && disallowed.includes('Bash') && disallowed.includes('Agent'));
    assert.match(claude, /not an OS sandbox/);
    const opencode = read(dest, `opencode/agents/${name}.md`);
    assert.deepEqual(JSON.parse(opencode.match(/^permission: (.+)$/m)[1]), permission);
    assert.ok(opencode.includes(fs.readFileSync(path.join(ROOT, 'core/agents', `${name}.md`), 'utf8')));
    assert.match(read(dest, `antigravity/agents/${name}.md`), /advisory declarations/);
    assert.ok(fs.readFileSync(path.join(__dirname, '../core/agents', `${name}.md`), 'utf8').split('\n').length < 60);
  }
  assert.deepEqual(openCodePermissions(roles['spec-writer']).edit, { '*': 'deny', 'spec/**': 'allow' });
  assert.equal(openCodePermissions(roles.orchestrator).task['planner-agent'], 'allow');
  assert.equal(openCodePermissions(roles.orchestrator).task['*'], 'deny');
  assert.equal(openCodePermissions(roles.orchestrator).bash, 'ask');
  assert.equal(openCodePermissions(roles.orchestrator).edit, undefined);
  const delegateNames = Object.keys(openCodePermissions(roles.orchestrator).task).filter(name => name !== '*');
  assert.deepEqual(delegateNames.sort(), Object.keys(roles).filter(name => name !== 'orchestrator').sort());
  for (const name of ['ai-engineer', 'automation-integration-agent']) {
    assert.equal(openCodePermissions(roles[name]).edit, 'allow');
    assert.match(read(dest, `cursor/rules/00-quality-gates.mdc`), new RegExp(`core/agents/${name}\\.md`));
    assert.match(read(dest, 'windsurf/rules/sdd.md'), new RegExp(`core/skills/${name}/SKILL\\.md`));
  }
  const config = JSON.parse(read(dest, 'opencode/opencode.json'));
  assert.equal(config.$schema, 'https://opencode.ai/config.json');
  assert.equal(config.default_agent, 'orchestrator');
  assert.deepEqual(config.instructions, ['.sdd/core/rules/AGENTS.md']);
  assert.deepEqual(config.skills.paths, ['.sdd/core/skills']);
  for (const harness of ['opencode', 'claude-code', 'cursor', 'windsurf', 'antigravity']) {
    const capabilities = JSON.parse(read(dest, `${harness}/capabilities.json`));
    assert.deepEqual(capabilities.roles, roles);
    assert.ok(capabilities.limitations.length);
  }
});

test('external run and global resource access requires approval without widening reader tools', t => {
  const f = fixture(t);
  deploy({ target: f.root, harnesses: ['opencode'], global: true });
  const roles = registry();
  for (const [name, role] of Object.entries(roles)) {
    const prompt = read(f.root, `.config/opencode/agents/${name}.md`);
    const permission = JSON.parse(prompt.match(/^permission: (.+)$/m)[1]);
    assert.equal(permission.external_directory, 'ask');
    assert.equal(permission['*'], 'deny');
    assert.match(prompt, /Explicitly request read access to the concrete run directory/);
    assert.match(prompt, /Never request blanket filesystem access/);
    assert.ok(prompt.includes(path.join(f.root, '.sdd/global/core/references/')));
    if (role.kind === 'reader') {
      for (const tool of ['read', 'glob', 'grep', 'list']) assert.equal(permission[tool], 'allow');
      for (const tool of ['edit', 'bash', 'task']) assert.equal(permission[tool], undefined);
    }
  }
  const capabilities = JSON.parse(read(f.root, '.sdd/global/capabilities/opencode.json'));
  assert.ok(capabilities.limitations.some(limit => /External directories require approval/.test(limit)));
});

test('compilation keeps MCP templates inert and independent of process secrets', t => {
  const f = fixture(t), dest = path.join(f.temp, 'adapters');
  const before = process.env.N8N_MCP_TOKEN;
  process.env.N8N_MCP_TOKEN = 'test-secret-never-serialize';
  try { compile(dest); }
  finally { if (before === undefined) delete process.env.N8N_MCP_TOKEN; else process.env.N8N_MCP_TOKEN = before; }
  const template = read(ROOT, 'mcp/mcp_config.template.json');
  for (const file of ['cursor/mcp.template.json', 'antigravity/mcp_config.template.json']) {
    assert.equal(read(dest, file), template);
    assert.match(read(dest, file), /\$\{N8N_MCP_TOKEN\}/);
    assert.equal(read(dest, file).includes('test-secret-never-serialize'), false);
  }
  assert.equal(fs.existsSync(path.join(dest, 'cursor/mcp.json')), false);
  assert.equal(fs.existsSync(path.join(dest, 'antigravity/mcp_config.json')), false);
});
test('deployment preserves user configs, supports repeat installs and rejects modified generated agents', t => {
  const f = fixture(t);
  f.write('opencode.json', '{"model":"user/model"}');
  f.write('CLAUDE.md', 'user instructions');
  deploy({ target: f.root, harnesses: ['opencode', 'claude'] });
  assert.equal(fs.readFileSync(path.join(f.root, 'opencode.json'), 'utf8'), '{"model":"user/model"}');
  assert.equal(fs.readFileSync(path.join(f.root, 'CLAUDE.md'), 'utf8'), 'user instructions');
  assert.ok(fs.existsSync(path.join(f.root, '.opencode/sdd.config.json')));
  assert.ok(fs.existsSync(path.join(f.root, '.sdd/scripts/lib/gates.js')));
  deploy({ target: f.root, harnesses: ['opencode', 'claude'] });
  f.write('.opencode/agents/frontend-agent.md', 'user customization');
  assert.throws(() => deploy({ target: f.root, harnesses: ['opencode'] }), /Preserving customized file/);
});
test('global OpenCode deployment uses absolute resource paths and preserves JSONC config', t => {
  const f = fixture(t);
  f.write('.config/opencode/opencode.jsonc', '// user configuration\n{}');
  deploy({ target: f.root, harnesses: ['opencode'], global: true });
  assert.equal(fs.existsSync(path.join(f.root, '.config/opencode/opencode.json')), false);
  const fragment = JSON.parse(fs.readFileSync(path.join(f.root, '.config/opencode/sdd.config.json'), 'utf8'));
  assert.equal(fragment.skills.paths[0], path.join(fs.realpathSync(f.root), '.sdd/global/core/skills'));
  const prompt = fs.readFileSync(path.join(f.root, '.config/opencode/agents/orchestrator.md'), 'utf8');
  assert.ok(prompt.includes(path.join(fs.realpathSync(f.root), '.sdd/global/core/references/')));
});

test('all harnesses install all relevant skills and new specialists and reinstall without drift', t => {
  const f = fixture(t);
  deploy({ target: f.root, harnesses: ['all'] });
  const skills = fs.readdirSync(path.join(ROOT, 'core/skills'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name !== 'software-architect-orchestrator').map(entry => entry.name);
  for (const name of ['ai-evaluation', 'ai-security', 'ai-engineer', 'automation-integration-agent']) assert.ok(skills.includes(name));
  for (const directory of ['.sdd/core/skills', '.claude/skills', '.cursor/skills', '.windsurf/skills', '.agents/skills']) {
    for (const skill of skills) assert.equal(read(f.root, `${directory}/${skill}/SKILL.md`), read(ROOT, `core/skills/${skill}/SKILL.md`));
    assert.equal(fs.existsSync(path.join(f.root, directory, 'software-architect-orchestrator')), false);
  }
  for (const directory of ['.opencode/agents', '.claude/agents', '.agents/agents']) {
    assert.equal(fs.readdirSync(path.join(f.root, directory)).length, Object.keys(registry()).length);
    for (const name of ['ai-engineer', 'automation-integration-agent']) assert.ok(fs.existsSync(path.join(f.root, directory, `${name}.md`)));
  }
  const manifest = read(f.root, '.sdd/install-manifest.json');
  deploy({ target: f.root, harnesses: ['all'] });
  assert.equal(read(f.root, '.sdd/install-manifest.json'), manifest);
  assert.equal(fs.existsSync(path.join(f.root, '.opencode/sdd.config.json')), false);
  assert.equal(fs.existsSync(path.join(f.root, '.claude/SDD.md')), false);
});

test('project and global deployments keep scope and resources separate', t => {
  const f = fixture(t), project = path.join(f.root, 'project');
  fs.mkdirSync(project);
  deploy({ target: f.root, harnesses: ['all'], global: true });
  assert.equal(fs.existsSync(path.join(f.root, 'CLAUDE.md')), false);
  assert.ok(fs.existsSync(path.join(f.root, '.claude/CLAUDE.md')));
  assert.equal(fs.existsSync(path.join(f.root, '.sdd/install-manifest.json')), false);
  const manifest = read(f.root, '.sdd/global/install-manifest.json');
  deploy({ target: project, harnesses: ['all'] });
  deploy({ target: f.root, harnesses: ['all'], global: true });
  assert.equal(read(f.root, '.sdd/global/install-manifest.json'), manifest);
  const config = JSON.parse(read(project, 'opencode.json'));
  assert.deepEqual(config.skills.paths, [path.join(fs.realpathSync(project), '.sdd/core/skills')]);
  assert.ok(read(f.root, '.claude/CLAUDE.md').includes(path.join(fs.realpathSync(f.root), '.sdd/global/core/')));
  assert.ok(read(f.root, '.sdd/global/core/references/tooling.md').includes(path.join(fs.realpathSync(f.root), '.sdd/global/scripts/baseline.js')));
  assert.equal(read(f.root, '.cursor/sdd.mcp.template.json'), read(ROOT, 'mcp/mcp_config.template.json'));
  assert.equal(read(project, '.opencode/agents/ai-engineer.md').includes('.sdd/global/'), false);
});

test('conflicts are detected before writing and obsolete user agents are never removed', t => {
  const f = fixture(t);
  f.write('.opencode/agents/ai-engineer.md', 'custom agent');
  f.write('.opencode/agents/software-architect-orchestrator.md', 'obsolete user agent');
  assert.throws(() => deploy({ target: f.root, harnesses: ['opencode'] }), /Preserving customized file/);
  assert.equal(read(f.root, '.opencode/agents/ai-engineer.md'), 'custom agent');
  assert.equal(fs.existsSync(path.join(f.root, '.sdd/core')), false);
  assert.equal(read(f.root, '.opencode/agents/software-architect-orchestrator.md'), 'obsolete user agent');
});

test('deployment rejects symlink files, directories and manifests without writing through them', t => {
  for (const relative of ['.opencode', '.opencode/agents/ai-engineer.md', '.sdd/install-manifest.json']) {
    const f = fixture(t), external = path.join(f.temp, 'external');
    fs.mkdirSync(external);
    const link = path.join(f.root, relative);
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(relative === '.opencode' ? external : path.join(external, 'missing'), link);
    assert.throws(() => deploy({ target: f.root, harnesses: ['opencode'] }), /Symlink path rejected/);
    assert.deepEqual(fs.readdirSync(external), []);
  }
});

test('compilation rejects symlink destinations', t => {
  const f = fixture(t), link = path.join(f.temp, 'linked');
  fs.symlinkSync(f.root, link);
  assert.throws(() => compile(path.join(link, 'adapters')), /Symlink path rejected/);
  assert.equal(fs.existsSync(path.join(f.root, 'adapters')), false);
});

test('identical pre-existing user files are not adopted as managed files', t => {
  const f = fixture(t), dest = path.join(f.temp, 'compiled');
  compile(dest);
  f.write('.opencode/agents/ai-engineer.md', read(dest, 'opencode/agents/ai-engineer.md'));
  deploy({ target: f.root, harnesses: ['opencode'] });
  const manifest = JSON.parse(read(f.root, '.sdd/install-manifest.json'));
  assert.equal(Object.hasOwn(manifest.files, '.opencode/agents/ai-engineer.md'), false);
  f.write('.opencode/agents/ai-engineer.md', 'user changed original file');
  assert.throws(() => deploy({ target: f.root, harnesses: ['opencode'] }), /Preserving customized file/);
  assert.equal(read(f.root, '.opencode/agents/ai-engineer.md'), 'user changed original file');
});
