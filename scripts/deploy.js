#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { hash, readJson, writeJson, safePath, parseArgs, failure } = require('./lib/run');
const { compile } = require('./sync');
const ROOT = path.resolve(__dirname, '..');

function deploy({ target, harnesses = ['opencode'], global = false }) {
  target = fs.realpathSync(target);
  const supported = ['opencode', 'claude', 'cursor', 'windsurf', 'antigravity'];
  if (harnesses.includes('all')) harnesses = supported;
  if (harnesses.some(h => !supported.includes(h))) throw new Error('Unsupported harness');
  const source = fs.realpathSync(ROOT);
  const relativeTarget = path.relative(source, target);
  if (!relativeTarget || (!relativeTarget.startsWith(`..${path.sep}`) && relativeTarget !== '..' && !path.isAbsolute(relativeTarget)))
    throw new Error('Choose a consumer project directory, not the SDD source directory or its descendants');
  const resourceDir = global ? '.sdd/global' : '.sdd';
  const manifestPath = safePath(target, `${resourceDir}/install-manifest.json`);
  const previous = fs.existsSync(manifestPath) ? readJson(manifestPath) : { version: 1, files: {} };
  if (previous.version !== 1 || !previous.files || typeof previous.files !== 'object' || Array.isArray(previous.files)) throw new Error('Invalid install manifest');
  const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'sdd-adapters-'));
  try {
  const adapters = path.join(temporary, 'adapters');
  compile(adapters);
  const files = new Map();
  const add = (relative, data) => { safePath(target, relative); files.set(relative, Buffer.isBuffer(data) ? data : Buffer.from(data)); };
  function tree(source, destination) {
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      if (['node_modules', '.DS_Store', '.env', '.git', 'software-architect-orchestrator'].includes(entry.name)) continue;
      const src = path.join(source, entry.name), dest = path.join(destination, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlink source rejected: ${src}`);
      if (entry.isDirectory()) tree(src, dest);
      else if (entry.isFile()) {
        let data = fs.readFileSync(src);
        if (global && /\.(md|mdc)$/.test(entry.name))
          data = Buffer.from(data.toString().replaceAll('.sdd/', `${target}/${resourceDir}/`));
        add(dest, data);
      }
    }
  }
  tree(path.join(ROOT, 'core'), `${resourceDir}/core`);
  tree(path.join(ROOT, 'scripts'), `${resourceDir}/scripts`);
  tree(path.join(ROOT, 'tools'), `${resourceDir}/tools`);
  function skills(destination) { tree(path.join(ROOT, 'core/skills'), destination); }
  const owned = relative => Object.hasOwn(previous.files, relative);
  const exists = relative => fs.existsSync(safePath(target, relative));
  function text(file) {
    const content = fs.readFileSync(path.join(adapters, file), 'utf8');
    return global && /\.(md|mdc)$/.test(file) ? content.replaceAll('.sdd/', `${target}/${resourceDir}/`) : content;
  }
  for (const harness of harnesses) {
    if (harness === 'opencode') {
      const configDir = global ? '.config/opencode' : '.opencode';
      tree(path.join(adapters, 'opencode/agents'), `${configDir}/agents`);
      const config = readJson(path.join(adapters, 'opencode/opencode.json'));
      // Absolute resources also work when the preserved-config fragment is loaded explicitly.
      config.instructions = [path.join(target, resourceDir, 'core/rules/AGENTS.md')];
      config.skills.paths = [path.join(target, resourceDir, 'core/skills')];
      const configPath = global ? '.config/opencode/opencode.json' : 'opencode.json';
      const configs = global ? [configPath, '.config/opencode/opencode.jsonc'] :
        [configPath, 'opencode.jsonc', '.opencode/opencode.json', '.opencode/opencode.jsonc'];
      if (configs.some(file => exists(file) && !owned(file))) add(`${configDir}/sdd.config.json`, JSON.stringify(config, null, 2) + '\n');
      else add(configPath, JSON.stringify(config, null, 2) + '\n');
    } else if (harness === 'claude') {
      tree(path.join(adapters, 'claude-code/agents'), '.claude/agents');
      skills('.claude/skills');
      const rulesPath = global ? '.claude/CLAUDE.md' : 'CLAUDE.md';
      add(exists(rulesPath) && !owned(rulesPath) ? '.claude/SDD.md' : rulesPath, text('claude-code/CLAUDE.md'));
    } else if (harness === 'cursor') {
      tree(path.join(adapters, 'cursor/rules'), '.cursor/rules');
      skills('.cursor/skills');
      add('.cursor/sdd.mcp.template.json', text('cursor/mcp.template.json'));
    } else if (harness === 'windsurf') {
      tree(path.join(adapters, 'windsurf/rules'), '.windsurf/rules');
      skills('.windsurf/skills');
    }
    else {
      tree(path.join(adapters, 'antigravity/agents'), '.agents/agents');
      skills('.agents/skills');
      add('.agents/rules/sdd.md', text('antigravity/rules/sdd.md'));
      add('.agents/sdd.mcp_config.template.json', text('antigravity/mcp_config.template.json'));
    }
    const adapterName = harness === 'claude' ? 'claude-code' : harness;
    const capabilities = readJson(path.join(adapters, adapterName, 'capabilities.json'));
    if (global) capabilities.reference = path.join(target, resourceDir, 'core/references/harness-support.md');
    add(`${resourceDir}/capabilities/${harness}.json`, JSON.stringify(capabilities, null, 2) + '\n');
  }
  for (const [relative, data] of files) {
    const file = safePath(target, relative);
    if (fs.existsSync(file)) {
      if (!fs.statSync(file).isFile()) throw new Error(`Not a file: ${relative}`);
      const current = hash(fs.readFileSync(file));
      if (current !== hash(data) && current !== previous.files[relative]) throw new Error(`Preserving customized file: ${relative}. Merge manually before redeploying.`);
    }
  }
  for (const [relative, data] of files) {
    const file = safePath(target, relative);
    // An identical pre-existing user file is not ours to update on later installs.
    if (fs.existsSync(file) && !owned(relative)) continue;
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data);
    previous.files[relative] = hash(data);
  }
  writeJson(manifestPath, previous);
  return { target, harnesses, files: files.size, notes: [
    'Restart OpenCode after deployment.',
    'Merge sdd.config.json explicitly when an existing OpenCode configuration was preserved.',
    'If CLAUDE.md was preserved, include .claude/SDD.md explicitly.',
    `Cursor/Windsurf/Antigravity enforcement and global discovery are advisory: see ${resourceDir}/core/references/harness-support.md.`,
    'No user files or obsolete agents are deleted. Review and disable obsolete customized roles manually.',
    'MCP templates are inert; configure credentials and narrowly authorize tools separately.'
  ] };
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
if (require.main === module) {
  try {
    const a = parseArgs(process.argv.slice(2), ['target', 'harnesses', 'global']);
    if (a.global !== undefined && !['true', 'false'].includes(a.global)) throw new Error('global must be true or false');
    console.log(JSON.stringify(deploy({ target: a.target ?? (a.global === 'true' ? os.homedir() : process.cwd()), harnesses: a.harnesses?.split(','), global: a.global === 'true' })));
  } catch (error) { failure(error); }
}
module.exports = { deploy };
