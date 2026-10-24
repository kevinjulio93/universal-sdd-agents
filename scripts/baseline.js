#!/usr/bin/env node
const { fs, path, os, crypto, hash, writeJson, safePath, contents, loadRun, scope, parseArgs, failure } = require('./lib/run');

function capture({ root = process.cwd(), files, directory, tempParent = os.tmpdir() }) {
  root = fs.realpathSync(root);
  if (!Array.isArray(files) || !files.length) throw new Error('Explicit file list required');
  // Validate everything before creating/extending anything.
  const selected = [...new Set(files.map(file => path.relative(root, safePath(root, file)).split(path.sep).join('/')))];
  selected.forEach(file => contents(root, file));
  let manifest;
  if (directory) {
    const existing = loadRun(directory);
    directory = existing.directory;
    manifest = existing.manifest;
    if (root !== manifest.root) throw new Error('Baseline belongs to another checkout');
  } else {
    directory = fs.mkdtempSync(path.join(fs.realpathSync(tempParent), 'sdd-run-'));
    fs.mkdirSync(path.join(directory, 'before'));
    fs.mkdirSync(path.join(directory, 'evidence'));
    manifest = { version: 1, kind: 'sdd-baseline', runId: crypto.randomUUID(), root,
      createdAt: new Date().toISOString(), files: {} };
  }
  for (const file of selected) {
    if (Object.hasOwn(manifest.files, file)) continue;
    const data = contents(root, file);
    Object.defineProperty(manifest.files, file, { value: { hash: data === null ? null : hash(data) }, enumerable: true, configurable: true, writable: true });
    if (data !== null) {
      const target = safePath(path.join(directory, 'before'), file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data, { flag: 'wx', mode: 0o600 });
    }
  }
  writeJson(path.join(directory, 'baseline.json'), manifest);
  return { runId: manifest.runId, directory, manifest: path.join(directory, 'baseline.json'),
    beforeDirectory: path.join(directory, 'before'), files: selected };
}

// LCS line attribution. Very large edits conservatively include the changed region.
function changedLines(before, after) {
  const lines = data => data === null ? [] : data.toString('utf8').split(/\r?\n/);
  const a = lines(before), b = lines(after);
  let start = 0, endA = a.length, endB = b.length;
  while (start < endA && start < endB && a[start] === b[start]) start++;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const n = endA - start, m = endB - start;
  if (n * m > 2000000) return Array.from({ length: m }, (_, i) => start + i + 1);
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[start + i] === b[start + j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let i = 0, j = 0;
  const changed = [];
  while (j < m) {
    if (i < n && a[start + i] === b[start + j]) { i++; j++; }
    else if (i < n && dp[i + 1][j] >= dp[i][j + 1]) i++;
    else { changed.push(start + j + 1); j++; }
  }
  return changed;
}
function delta(directory) {
  const run = loadRun(directory);
  return { runId: run.manifest.runId, ...scope(run), changes: Object.entries(run.manifest.files).flatMap(([file, entry]) => {
    const after = contents(run.manifest.root, file);
    if ((after === null ? null : hash(after)) === entry.hash) return [];
    const before = contents(path.join(run.directory, 'before'), file);
    return [{ file, kind: before === null ? 'added' : after === null ? 'deleted' : 'modified', lines: changedLines(before, after) }];
  }) };
}
if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2), ['root', 'files', 'run', 'temp-parent', 'delta']);
    const result = args.delta ? delta(args.delta) : capture({ root: args.root, files: args.files?.split(','), directory: args.run, tempParent: args['temp-parent'] });
    console.log(JSON.stringify(result));
  } catch (error) { failure(error); }
}
module.exports = { capture, delta, changedLines };
