#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { safePath, failure } = require('./lib/run');

const ROOT = path.resolve(__dirname, '..');
const CORE = path.join(ROOT, 'core');
const json = value => JSON.stringify(value, null, 2) + '\n';
const read = file => fs.readFileSync(file, 'utf8');

function registry() {
  const { version, roles } = JSON.parse(read(path.join(CORE, 'roles.json')));
  if (version !== 1 || !roles || !roles.orchestrator) throw new Error('Invalid role registry');
  for (const [name, role] of Object.entries(roles)) {
    if (!/^[a-z][a-z0-9-]*$/.test(name) || !['reader', 'writer', 'coordinator'].includes(role.kind) ||
        typeof role.description !== 'string' || !Array.isArray(role.write) ||
        role.write.some(pattern => typeof pattern !== 'string' || pattern.startsWith('/') || pattern.includes('..')) ||
        (role.kind !== 'coordinator' && (role.shell || role.delegate))) throw new Error(`Invalid role: ${name}`);
  }
  return roles;
}

function openCodePermissions(role) {
  const permission = { '*': 'deny', read: 'allow', glob: 'allow', grep: 'allow', list: 'allow', skill: 'allow', webfetch: 'allow', external_directory: 'ask' };
  if (role.kind === 'writer' && role.write.length) {
    // "assigned" is a runtime ownership contract, not a static filesystem sandbox.
    permission.edit = role.write.includes('assigned') ? 'allow' :
      { '*': 'deny', ...Object.fromEntries(role.write.map(pattern => [pattern, 'allow'])) };
  }
  if (role.kind === 'coordinator') {
    if (role.shell) permission.bash = 'ask';
    if (role.delegate) permission.task = { '*': 'deny', ...Object.fromEntries(Object.keys(registry())
      .filter(name => name !== 'orchestrator').map(name => [name, 'allow'])) };
    permission.question = 'allow';
  }
  return permission;
}

function compile(destination = path.join(ROOT, 'adapters')) {
  const roles = registry();
  const names = Object.keys(roles);
  const rules = read(path.join(CORE, 'rules/AGENTS.md'));
  const prompts = Object.fromEntries(names.map(name => [name, read(path.join(CORE, 'agents', `${name}.md`))]));
  // Read all required inputs before creating any output, including during concurrent core edits.
  for (const name of ['sdd-protocol', ...names]) read(path.join(CORE, 'skills', name, 'SKILL.md'));
  if (roles['ai-engineer']) {
    for (const name of ['ai-evaluation', 'ai-security']) read(path.join(CORE, 'skills', name, 'SKILL.md'));
  }
  const mcp = read(path.join(ROOT, 'mcp/mcp_config.template.json'));
  JSON.parse(mcp);
  const files = new Map();
  const add = (file, content) => files.set(file, content);
  const resources = '\n\nSDD resources: `.sdd/core/roles.json`, `.sdd/core/references/`, `.sdd/core/skills/`.\n' +
    'Resolve reference paths relative to `.sdd/core/`, not the current skill folder.\n' +
    'Load sdd-protocol and your role skill once; read their SKILL.md files if no native loader is available.\n' +
    'Knowledge access is local read or WebFetch/webfetch only when supported. MCP and remote mutation are not authorized.\n' +
    'Assigned paths are a procedural ownership contract, not an OS sandbox. Do not expand them without approval.\n';
  const limitations = {
    opencode: ['Per-agent native permission rules; unlisted tools (including MCP) denied.',
      'External directories require approval: request only the concrete run directory or installed global resource directory needed for reading, never blanket filesystem access. Approval does not grant edit, bash or task permissions.',
      'General writer assigned paths are procedural; spec-writer uses spec/** edit patterns.',
      'Coordinator shell requires approval, but approved commands are not sandboxed.',
      'Parent/user permissions can further restrict tools. Restart after installing.'],
    'claude-code': ['Native tools allowlist and disallowedTools; no MCP tools are allowlisted.',
      'Use --agent orchestrator as the main agent for named Agent delegation; nested subagents cannot delegate.',
      'File assignments (including spec/**) are procedural, not native path enforcement.',
      'Coordinator Bash uses normal user permissions, not an adapter-enforced ask or sandbox; never use bypassPermissions.'],
    cursor: ['Generated rules are advisory; no per-role tool denial or file sandbox is enforced.',
      'Durable subagent resume and global rule discovery are not assumed; explicitly import global rules.'],
    windsurf: ['Generated rules are advisory; no per-role tool denial or file sandbox is enforced.',
      'Durable subagent resume and global rule discovery are not assumed; explicitly import global rules.'],
    antigravity: ['Advertised tools only: declarations are not a verified permission boundary.',
      'Verify native agent discovery, tool support and conversation resume in the installed runtime.',
      'Assigned file scope, remote mutation denial and global discovery are advisory, not sandbox guarantees.']
  };
  const roleReferences = '\n\n## Canonical Roles\n\n' + names.map(name =>
    `- ${name}: \`.sdd/core/agents/${name}.md\`; skill \`.sdd/core/skills/${name}/SKILL.md\`.`).join('\n') +
    '\n\nShared protocol: `.sdd/core/skills/sdd-protocol/SKILL.md`. Read each selected role prompt and skill before acting.\n' +
    'These references do not create native subagents or enforce tool restrictions.\n';

  for (const harness of Object.keys(limitations)) {
    add(`${harness}/capabilities.json`, json({ version: 1, harness, roles,
      enforcement: ['opencode', 'claude-code'].includes(harness) ? 'native-tools' : 'advisory',
      limitations: limitations[harness], reference: '.sdd/core/references/harness-support.md' }));
  }
  for (const [name, role] of Object.entries(roles)) {
    const permission = openCodePermissions(role);
    add(`opencode/agents/${name}.md`, `---\ndescription: ${JSON.stringify(role.description)}\nmode: ${JSON.stringify(role.kind === 'coordinator' ? 'primary' : 'subagent')}\npermission: ${JSON.stringify(permission)}\n---\n\n${prompts[name]}${resources}\nExternal directory access requires approval. Explicitly request read access to the concrete run directory (including temporary evidence) or installed global resource directory needed for this task. Never request blanket filesystem access; directory approval does not grant edit, bash or task permissions.\n`);

    const tools = ['Read', 'Glob', 'Grep', 'WebFetch', 'Skill'];
    const disallowed = ['NotebookEdit'];
    if (role.kind === 'writer' && role.write.length) tools.push('Edit', 'Write');
    else disallowed.push('Edit', 'Write');
    if (role.kind === 'coordinator' && role.shell) tools.push('Bash');
    else disallowed.push('Bash');
    if (role.kind === 'coordinator' && role.delegate) tools.push(`Agent(${names.filter(n => n !== 'orchestrator').join(', ')})`);
    else disallowed.push('Agent', 'Task');
    add(`claude-code/agents/${name}.md`, `---\nname: ${name}\ndescription: ${JSON.stringify(role.description)}\ntools: ${JSON.stringify(tools)}\ndisallowedTools: ${JSON.stringify(disallowed)}\n---\n\n${prompts[name]}${resources}`);

    const advertised = ['read', 'search', 'webfetch'];
    if (role.kind === 'writer' && role.write.length) advertised.push('edit');
    if (role.kind === 'coordinator' && role.shell) advertised.push('shell (user approval required)');
    if (role.kind === 'coordinator' && role.delegate) advertised.push(`delegate (${names.filter(n => n !== 'orchestrator').join(', ')})`);
    add(`antigravity/agents/${name}.md`, `---\nname: ${name}\ndescription: ${JSON.stringify(role.description)}\n---\n\nAdvertised tools: ${advertised.join('; ')}.\nThese are advisory declarations, not verified native permission enforcement.\n\n${prompts[name]}${resources}`);
  }
  add('opencode/opencode.json', json({ $schema: 'https://opencode.ai/config.json', default_agent: 'orchestrator',
    instructions: ['.sdd/core/rules/AGENTS.md'], skills: { paths: ['.sdd/core/skills'] } }));
  add('claude-code/CLAUDE.md', rules + resources + '\nUse `claude --agent orchestrator` for native named delegation.\n');
  add('cursor/.cursorrules', rules + roleReferences + resources);
  add('cursor/rules/00-quality-gates.mdc', '---\ndescription: SDD protocol and canonical role references\nalwaysApply: true\n---\n\n' + rules + roleReferences + resources);
  add('windsurf/.windsurfrules', rules + roleReferences + resources);
  add('windsurf/rules/sdd.md', '---\ntrigger: always_on\n---\n\n' + rules + roleReferences + resources);
  add('antigravity/rules/sdd.md', rules + roleReferences + resources);
  add('antigravity/plugin.json', json({ name: 'engineering-team-orchestrator', version: '2.0.0',
    description: 'Generated SDD role prompts. Consult capabilities.json for runtime enforcement limits.' }));
  // Templates remain inert and byte-for-byte unchanged; no environment is read or interpolated.
  for (const file of ['cursor/mcp.template.json', 'antigravity/mcp_config.template.json']) add(file, mcp);

  destination = path.resolve(destination);
  // Reject symlink ancestors even if the destination itself does not yet exist.
  for (const file of files.keys()) safePath(path.parse(destination).root, path.join(destination, file));
  for (const file of files.keys()) {
    const absolute = path.join(destination, file);
    if (fs.existsSync(absolute) && !fs.statSync(absolute).isFile()) throw new Error(`Not a file: ${absolute}`);
  }
  for (const [file, content] of files) {
    const absolute = path.join(destination, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
  }
  return { destination, roles: names, files: files.size };
}

if (require.main === module) {
  try { console.log(JSON.stringify(compile(process.argv[2]))); }
  catch (error) { failure(error); }
}
module.exports = { compile, openCodePermissions };
