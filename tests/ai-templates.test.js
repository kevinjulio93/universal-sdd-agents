const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { configFor, executeGate } = require('../scripts/lib/gates');
const { fixture } = require('./helpers');
const { deploy } = require('../scripts/deploy');

for (const name of ['checks.example.json', 'checks.ai.example.json']) {
  test(`${name} validates with the current consumer config contract`, t => {
    const f = fixture(t);
    const template = JSON.parse(fs.readFileSync(path.join(__dirname, '../core/templates', name), 'utf8'));
    f.write('checks.json', template);
    const { config, digest } = configFor(f.configPath);
    assert.deepEqual(config, template);
    assert.match(digest, /^[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(config.gates), ['G0', 'G1', 'G2', 'G3', 'G4']);
  });
}

test('AI template requires QA/security and marks every consumer command as unimplemented', t => {
  const f = fixture(t);
  const template = JSON.parse(fs.readFileSync(path.join(__dirname, '../core/templates/checks.ai.example.json'), 'utf8'));
  f.write('checks.json', template);
  const { config } = configFor(f.configPath);
  assert.deepEqual(config.requiredReviews, ['qa-agent', 'security-agent']);
  for (const gate of Object.values(config.gates)) {
    assert.equal(gate.applicable, true);
    for (const check of gate.checks) {
      assert.equal(check.format, 'exit-code');
      assert.equal(check.command[0], 'node');
      assert.match(check.command[1], /^A_IMPLEMENTAR\//);
      assert.ok(check.timeoutMs > 0);
    }
  }
  const result = executeGate({ directory: f.run.directory, configPath: f.configPath, gate: 'G0' });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.checks[0].status, 'BLOCKED');
  assert.notEqual(result.checks[0].exitCode, 0);
  const log = JSON.parse(fs.readFileSync(result.checks[0].evidence, 'utf8'));
  assert.match(log.stderr, /MODULE_NOT_FOUND/);
});

for (const global of [false, true]) {
  test(`AI references resolve from native ${global ? 'global' : 'project'} skills`, t => {
    const f = fixture(t);
    const target = fs.realpathSync(f.root);
    const names = ['ai-evaluation', 'ai-security'];
    const source = path.join(__dirname, '../core/skills');
    const original = names.map(name => fs.readFileSync(path.join(source, name, 'SKILL.md'), 'utf8'));
    deploy({ target, harnesses: ['all'], global });
    const resourceDir = global ? '.sdd/global' : '.sdd';
    const expected = path.join(target, resourceDir, 'core/references/ai-workflow.md');
    for (const directory of ['.claude/skills', '.cursor/skills', '.windsurf/skills', '.agents/skills', `${resourceDir}/core/skills`]) {
      for (const name of names) {
        const skill = fs.readFileSync(path.join(target, directory, name, 'SKILL.md'), 'utf8');
        const reference = skill.match(/Read `([^`]+\/references\/ai-workflow\.md)`/);
        assert.ok(reference, `${directory}/${name}: explicit shared reference required`);
        assert.equal(path.isAbsolute(reference[1]), global);
        // Global resources must resolve even from an unrelated consumer project.
        const cwd = global ? path.join(f.temp, 'other-project') : target;
        const resolved = path.resolve(cwd, reference[1]);
        assert.equal(resolved, expected);
        assert.match(fs.readFileSync(resolved, 'utf8'), /^# AI workflow, acceptance and evidence/);
        assert.doesNotMatch(skill, /\.\.\/\.\.\/references\//);
      }
    }
    for (const [index, name] of names.entries()) {
      assert.equal(fs.readFileSync(path.join(source, name, 'SKILL.md'), 'utf8'), original[index]);
    }
  });
}
