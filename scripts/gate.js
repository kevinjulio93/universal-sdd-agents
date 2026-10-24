#!/usr/bin/env node
const { parseArgs, loadRun, scope } = require('./lib/run');
const { executeGate, release } = require('./lib/gates');
const path = require('node:path');
let args;
try {
  const a = args = parseArgs(process.argv.slice(2), ['gate', 'run', 'phase', 'config']);
  const result = a.gate === 'G5' ? release({ directory: a.run, configPath: a.config }) :
    executeGate({ directory: a.run, gate: a.gate, phase: a.phase, configPath: a.config });
  console.log(JSON.stringify(result));
  if (!['PASS', 'NOT_APPLICABLE'].includes(result.status)) process.exitCode = 1;
} catch (error) {
  let run;
  try { if (args?.run) run = loadRun(args.run); } catch { /* Invalid context remains explicitly unknown. */ }
  const now = new Date().toISOString();
  console.log(JSON.stringify({ version: 1, runId: run?.manifest.runId ?? null,
    gate: /^G[0-5]$/.test(args?.gate ?? '') ? args.gate : null,
    phase: args?.phase === 'before' ? 'before' : 'after', status: 'BLOCKED',
    startedAt: now, finishedAt: now, configDigest: null,
    scope: run ? scope(run) : null,
    baseline: run ? { manifest: path.join(run.directory, 'baseline.json'), beforeDirectory: path.join(run.directory, 'before') } : null,
    checks: [], findings: [], debt: [], gaps: [{ check: 'configuration', message: error.message }] }));
  process.exitCode = 1;
}
