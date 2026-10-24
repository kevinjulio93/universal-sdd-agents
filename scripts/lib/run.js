const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function writeJson(file, value) {
  // Registry updates are coordinator-serialized. Rename avoids partial readers.
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  fs.renameSync(temp, file);
}
function safePath(root, file) {
  if (typeof file !== 'string' || !file || /[\0\r\n]/.test(file)) throw new Error('Invalid file path');
  const absolute = path.resolve(root, file);
  const relative = path.relative(root, absolute);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`Path escapes root: ${file}`);
  for (let current = absolute; current !== root; current = path.dirname(current)) {
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Symlink path rejected: ${file}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return absolute;
}
function contents(root, file) {
  const absolute = safePath(root, file);
  if (!fs.existsSync(absolute)) return null;
  if (!fs.statSync(absolute).isFile()) throw new Error(`Not a file: ${file}`);
  return fs.readFileSync(absolute);
}
function loadRun(directory) {
  directory = fs.realpathSync(directory);
  const manifest = readJson(safePath(directory, 'baseline.json'));
  if (manifest.version !== 1 || manifest.kind !== 'sdd-baseline' || !manifest.runId || !manifest.files) throw new Error('Invalid SDD baseline');
  if (fs.realpathSync(manifest.root) !== manifest.root) throw new Error('Checkout identity changed');
  for (const [file, entry] of Object.entries(manifest.files)) {
    safePath(manifest.root, file);
    const before = contents(path.join(directory, 'before'), file);
    if ((before === null ? null : hash(before)) !== entry.hash) throw new Error(`Baseline copy changed: ${file}`);
  }
  return { directory, manifest };
}
function scope(run, phase = 'after') {
  const files = Object.keys(run.manifest.files).sort();
  const hashes = Object.fromEntries(files.map(file => [file, phase === 'before' ? run.manifest.files[file].hash :
    (() => { const data = contents(run.manifest.root, file); return data === null ? null : hash(data); })()]));
  return { files, hashes, digest: hash(JSON.stringify(hashes)), baselineDigest: hash(JSON.stringify(run.manifest.files)) };
}
function assertInitial(run) {
  if (scope(run).digest !== scope(run, 'before').digest) throw new Error('Before evidence must be captured before any scoped edits');
}
function parseArgs(args, allowed) {
  const result = {};
  for (const arg of args) {
    const match = arg.match(/^--([^=]+)=(.*)$/s);
    if (!match || !allowed.includes(match[1]) || Object.hasOwn(result, match[1])) throw new Error(`Invalid/duplicate option: ${arg}`);
    result[match[1]] = match[2];
  }
  return result;
}
function failure(error) {
  console.error(JSON.stringify({ status: 'BLOCKED', message: error.message }));
  process.exitCode = 1;
}
module.exports = { fs, path, os, crypto, hash, readJson, writeJson, safePath, contents, loadRun, scope, assertInitial, parseArgs, failure };
