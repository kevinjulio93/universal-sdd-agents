#!/usr/bin/env node
// Fresh Sonar analysis + complete issue snapshot, compared by the common runner.
const { spawnSync } = require('node:child_process');
const { fs, path, crypto, parseArgs } = require('./lib/run');
const { contextFingerprint } = require('./check');

async function sonarCheck({ project, branch, pullRequest, scanner = 'sonar-scanner', fetcher = fetch, runner = spawnSync, env = process.env }) {
  if (!project || !env.SONAR_HOST_URL || !env.SONAR_TOKEN || !env.SDD_RUN || !env.SDD_ROOT || !env.SDD_RUN_ID || !env.SDD_SCOPE_DIGEST || !env.SDD_PHASE) throw new Error('Project, SONAR_HOST_URL/TOKEN and gate execution environment required');
  if (branch && pullRequest) throw new Error('Select branch or pull request, not both');
  const host = new URL(env.SONAR_HOST_URL);
  if (!['http:', 'https:'].includes(host.protocol) || host.username || host.password) throw new Error('Invalid Sonar URL');
  const report = path.join(env.SDD_RUN, 'evidence', `sonar-${crypto.randomUUID()}.txt`);
  const args = [`-Dsonar.projectKey=${project}`, '-Dsonar.qualitygate.wait=false', `-Dsonar.scanner.metadataFilePath=${report}`,
    ...(branch ? [`-Dsonar.branch.name=${branch}`] : []), ...(pullRequest ? [`-Dsonar.pullrequest.key=${pullRequest}`] : [])];
  const scan = runner(scanner, args, { cwd: env.SDD_ROOT, env, encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024, shell: false });
  if (scan.error || scan.status !== 0) throw new Error('Sonar scanner failed; check server/tool configuration (credentials are not logged)');
  const properties = Object.fromEntries(fs.readFileSync(report, 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  if (!properties.ceTaskId || properties.projectKey !== project) throw new Error('Missing/mismatched fresh scanner metadata');
  async function api(endpoint, query = {}) {
    const url = new URL(`${host.toString().replace(/\/$/, '')}/${endpoint}`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    const response = await fetcher(url, { headers: { Authorization: `Bearer ${env.SONAR_TOKEN}` }, signal: AbortSignal.timeout(30000), redirect: 'error' });
    if (!response.ok) throw new Error(`Sonar API ${endpoint}: HTTP ${response.status}`);
    return response.json();
  }
  let task;
  const deadline = Date.now() + 300000;
  do {
    task = (await api('api/ce/task', { id: properties.ceTaskId })).task;
    if (task?.status === 'SUCCESS') break;
    if (!['PENDING', 'IN_PROGRESS'].includes(task?.status)) throw new Error('Sonar analysis failed/canceled');
    if (Date.now() > deadline) throw new Error('Sonar processing timeout');
    await new Promise(resolve => setTimeout(resolve, 1000));
  } while (true);
  if (!task.analysisId) throw new Error('Missing completed analysis ID');
  const selector = { ...(branch ? { branch } : {}), ...(pullRequest ? { pullRequest } : {}) };
  const snapshot = await api('api/issues/search', { componentKeys: project, resolved: 'false', ps: '500', p: '1', ...selector });
  if (!snapshot.paging || !Array.isArray(snapshot.issues)) throw new Error('Incomplete Sonar issue response');
  const total = snapshot.paging.total;
  if (!Number.isInteger(total) || total < 0 || total > 10000) throw new Error('Sonar issue pagination exceeds verifiable snapshot limits');
  const issues = [...snapshot.issues];
  for (let page = 2; issues.length < total; page++) {
    const next = await api('api/issues/search', { componentKeys: project, resolved: 'false', ps: '500', p: String(page), ...selector });
    if (next.paging?.total !== total || !next.issues?.length) throw new Error('Sonar issue snapshot changed/incomplete');
    issues.push(...next.issues);
  }
  if (issues.length !== total || new Set(issues.map(i => i.key)).size !== total) throw new Error('Incomplete/duplicate issue pages');
  // Issue search is latest-analysis based: refuse concurrent analysis races.
  const analyses = await api('api/project_analyses/search', { project, ps: '1', ...selector });
  if (analyses.analyses?.[0]?.key !== task.analysisId) throw new Error('Concurrent/unverifiable Sonar analysis; retry on an isolated branch/project');
  const diagnostics = issues.map(issue => {
    if (!issue.component?.startsWith(`${project}:`) || !issue.rule || !issue.message) throw new Error('Unsupported project-level issue; requires explicit investigation');
    const file = issue.component.slice(project.length + 1);
    const severity = { BLOCKER: 'critical', CRITICAL: 'critical', MAJOR: 'error', MINOR: 'warning', INFO: 'info' }[issue.severity];
    if (!severity) throw new Error('Unsupported Sonar severity schema');
    return { file, rule: issue.rule, message: issue.message, severity, ...(issue.line ? { line: issue.line } : {}),
      fingerprint: contextFingerprint(env.SDD_ROOT, file, issue.line, issue.message) };
  });
  return { complete: true, runId: env.SDD_RUN_ID, scopeDigest: env.SDD_SCOPE_DIGEST, phase: env.SDD_PHASE,
    source: 'sonarqube-issues', analysisId: task.analysisId, diagnostics,
    limitations: ['Issue snapshot only; hotspots, duplication and coverage require separate configured checks. Global Quality Gate is not used to reject task debt.'] };
}
if (require.main === module) {
  (async () => {
    try {
      const a = parseArgs(process.argv.slice(2), ['project', 'branch', 'pull-request', 'scanner']);
      console.log(JSON.stringify(await sonarCheck({ project: a.project, branch: a.branch, pullRequest: a['pull-request'], scanner: a.scanner })));
    } catch (error) {
      console.log(JSON.stringify({ toolStatus: 'BLOCKED', reason: error.message,
        runId: process.env.SDD_RUN_ID, scopeDigest: process.env.SDD_SCOPE_DIGEST, phase: process.env.SDD_PHASE }));
      process.exitCode = 1;
    }
  })();
}
module.exports = { sonarCheck };
