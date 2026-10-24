#!/usr/bin/env node
const { fs, path, readJson, writeJson, loadRun, parseArgs, failure } = require('./lib/run');
const { roles } = require('../core/roles.json');
function session({ directory, harness, parent, role, slot = 'default', id, replaceReason }) {
  const run = loadRun(directory);
  if (!['opencode', 'claude-code', 'antigravity', 'cursor', 'windsurf'].includes(harness) || !parent || !roles[role] || !slot) throw new Error('Valid harness, parent, role and owner slot required');
  const file = path.join(run.directory, 'sessions.json');
  const registry = fs.existsSync(file) ? readJson(file) : { version: 1, runId: run.manifest.runId, sessions: {} };
  if (registry.runId !== run.manifest.runId) throw new Error('Session registry belongs to another run');
  const key = JSON.stringify([harness, parent, role, slot]);
  const existing = registry.sessions[key];
  if (id !== undefined) {
    if (!id.trim() || /[\0\r\n]/.test(id)) throw new Error('Actual non-empty harness session ID required');
    if (existing && existing.id !== id && !replaceReason?.trim()) throw new Error('Resume existing session; replacement requires an expiry/unavailability reason');
    if (Object.entries(registry.sessions).some(([other, value]) => other !== key && value.harness === harness && value.id === id)) throw new Error('Session ID already belongs to another role/owner');
    registry.sessions[key] = { harness, parent, role, slot, id, ...(replaceReason ? { replaceReason, previousId: existing?.id } : {}) };
    writeJson(file, registry);
  }
  const entry = registry.sessions[key];
  return { action: entry ? 'resume' : 'spawn', ...entry,
    ...(entry && harness === 'opencode' ? { task_id: entry.id } : {}),
    ...(entry && harness === 'claude-code' ? { recipient: entry.id } : {}) };
}
if (require.main === module) {
  try {
    const a = parseArgs(process.argv.slice(2), ['run', 'harness', 'parent', 'role', 'slot', 'id', 'replace-reason']);
    console.log(JSON.stringify(session({ directory: a.run, harness: a.harness, parent: a.parent, role: a.role, slot: a.slot, id: a.id, replaceReason: a['replace-reason'] })));
  } catch (error) { failure(error); }
}
module.exports = { session };
