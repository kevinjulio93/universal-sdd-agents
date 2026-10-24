const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { capture, delta, changedLines } = require('../scripts/baseline');
const { loadRun } = require('../scripts/lib/run');
const { session } = require('../scripts/sessions');
const { fixture } = require('./helpers');

test('baseline works without Git, preserves user state and distinguishes additions/deletions', t => {
  const f = fixture(t);
  assert.equal(fs.existsSync(path.join(f.root, '.git')), false);
  f.write('src/example.js', 'const old = 1;\nconst value = 2;\n');
  f.write('src/new.js', 'new file');
  capture({ root: f.root, directory: f.run.directory, files: ['src/example.js', 'src/new.js'] });
  assert.match(fs.readFileSync(path.join(f.run.beforeDirectory, 'src/example.js'), 'utf8'), /value = 1/);
  assert.equal(fs.existsSync(path.join(f.run.beforeDirectory, 'src/new.js')), false);
  assert.deepEqual(delta(f.run.directory).changes.map(c => [c.file, c.kind, c.lines]), [
    ['src/example.js', 'modified', [2]], ['src/new.js', 'added', [1]]
  ]);
  fs.unlinkSync(path.join(f.root, 'src/example.js'));
  assert.equal(delta(f.run.directory).changes[0].kind, 'deleted');
});
test('baseline rejects escaping and symlink paths; tampered copies cannot be used', t => {
  const f = fixture(t);
  assert.throws(() => capture({ root: f.root, directory: f.run.directory, files: ['../outside'] }), /escapes/);
  fs.symlinkSync(f.temp, path.join(f.root, 'link'));
  assert.throws(() => capture({ root: f.root, files: ['link/anything'] }), /Symlink/);
  fs.writeFileSync(path.join(f.run.beforeDirectory, 'src/example.js'), 'tampered');
  assert.throws(() => loadRun(f.run.directory), /Baseline copy changed/);
});
test('line attribution excludes unchanged lines between separated edits', () => {
  assert.deepEqual(changedLines(Buffer.from('a\nb\nc\nd\ne'), Buffer.from('a\nB\nc\nD\ne')), [2, 4]);
  assert.deepEqual(changedLines(Buffer.from('a\nb'), Buffer.from('a')), []);
});
test('sessions reuse across sequential tasks and separate runs, parents and owners', t => {
  const f = fixture(t);
  const input = { directory: f.run.directory, harness: 'opencode', parent: 'parent', role: 'frontend-agent', slot: 'ui' };
  assert.equal(session(input).action, 'spawn');
  assert.equal(session({ ...input, id: 'actual-session' }).task_id, 'actual-session');
  assert.equal(session(input).action, 'resume');
  assert.equal(session({ ...input, parent: 'other' }).action, 'spawn');
  assert.equal(session({ ...input, slot: 'other' }).action, 'spawn');
  assert.throws(() => session({ ...input, id: 'fresh' }), /Resume existing/);
  assert.throws(() => session({ ...input, role: 'code-review-agent', id: 'actual-session' }), /already belongs/);
  assert.equal(session({ ...input, id: 'fresh', replaceReason: 'Harness reported expired ID' }).previousId, 'actual-session');
  const second = capture({ root: f.root, files: ['src/example.js'], tempParent: f.temp });
  assert.equal(session({ ...input, directory: second.directory }).action, 'spawn');
});
