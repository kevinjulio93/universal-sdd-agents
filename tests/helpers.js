const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { capture } = require('../scripts/baseline');
function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const root = path.join(temp, 'checkout'); fs.mkdirSync(root);
  const write = (file, value) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), typeof value === 'string' ? value : JSON.stringify(value)); };
  write('src/example.js', 'const old = 1;\nconst value = 1;\n');
  const run = capture({ root, files: ['src/example.js', 'src/new.js'], tempParent: temp });
  const config = { version: 1, acceptance: ['AC-01'], gates: Object.fromEntries(['G0', 'G1', 'G2', 'G3', 'G4'].map(gate => [gate, { applicable: false, reason: 'Not affected by fixture acceptance' }])) };
  const configPath = path.join(root, 'checks.json');
  const saveConfig = () => write('checks.json', config);
  saveConfig();
  return { temp, root, run, write, config, configPath, saveConfig };
}
const finding = { file: 'src/example.js', line: 1, rule: 'legacy', message: 'old issue', severity: 'error', fingerprint: 'old-context' };
const jsonRunner = findings => (_exe, _args, options) => ({ status: findings.length ? 1 : 0, stdout: JSON.stringify({ complete: true,
  runId: options.env.SDD_RUN_ID, scopeDigest: options.env.SDD_SCOPE_DIGEST, phase: options.env.SDD_PHASE, diagnostics: findings }) });
module.exports = { fixture, finding, jsonRunner };
