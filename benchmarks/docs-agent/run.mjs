#!/usr/bin/env node
// Runs the docs benchmark: for each task in tasks/, a fresh Claude Code agent builds the task's screen in a new Vite
// app, with this checkout's built docs as its only source on Lede. The harness then builds the app, runs the scripted
// checks and asks a blind grader for a second opinion. README.md says what it measures and how it stays fair.
//
//   npm run build && node benchmarks/docs-agent/run.mjs --label "before"
//
// Options: --task (all, or one name from tasks/), --model (claude-haiku-5-5), --effort (Claude Code's default; the
// effort applied is recorded either way), --runs per task (3), --budget USD per run (8), --minutes per run (30),
// --docs (a built site, dist/ by default), --label, --no-grade, --no-record (leave results.md alone).
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { isolatedArgs, isolatedEnv } from './agent.mjs';
import { serve } from './docs-server.mjs';
import { grade } from './grade.mjs';
import { build, check, readDocsLog, readLedeUse, readTranscript, score } from './measure.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const CREATE_VITE = '9.3.4';
const TOOLS = 'Bash,Read,Write,Edit,Glob,Grep';

const { values: args } = parseArgs({
  options: {
    task: { type: 'string', default: 'all' },
    model: { type: 'string', default: 'claude-haiku-5-5' },
    effort: { type: 'string' },
    runs: { type: 'string', default: '3' },
    budget: { type: 'string', default: '8' },
    minutes: { type: 'string', default: '30' },
    docs: { type: 'string', default: join(repo, 'dist') },
    label: { type: 'string', default: '' },
    'no-grade': { type: 'boolean', default: false },
    'no-record': { type: 'boolean', default: false },
  },
});

const docsRoot = resolve(args.docs);
if (!existsSync(join(docsRoot, 'llms.txt'))) {
  console.error(`No llms.txt in ${docsRoot}. Run \`npm run build\` first: the benchmark serves that build to the agent.`);
  process.exit(1);
}

const sh = (cmd, cmdArgs, cwd) => {
  const run = spawnSync(cmd, cmdArgs, { cwd, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`${cmd} ${cmdArgs.join(' ')} failed:\n${run.stdout}${run.stderr}`);
  return run.stdout.trim();
};

// The starting app, made once with a pinned create-vite and copied for each run.
function template() {
  const dir = join(here, '.cache', `create-vite-${CREATE_VITE}`);
  if (existsSync(join(dir, 'app', 'node_modules'))) return join(dir, 'app');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  console.log(`Making the starting app with create-vite ${CREATE_VITE}…`);
  sh('npm', ['create', `vite@${CREATE_VITE}`, 'app', '--', '--template', 'react-ts', '--no-interactive'], dir);
  sh('npm', ['install', '--no-audit', '--no-fund'], join(dir, 'app'));
  return join(dir, 'app');
}

const taskNames = args.task === 'all' ? readdirSync(join(here, 'tasks')).filter((name) => existsSync(join(here, 'tasks', name, 'task.md'))).sort() : [args.task];
const tasks = await Promise.all(
  taskNames.map(async (name) => {
    const dir = join(here, 'tasks', name);
    const module = await import(pathToFileURL(join(dir, 'check.mjs')).href);
    return { name, dir, module, text: readFileSync(join(dir, 'task.md'), 'utf8'), data: JSON.parse(readFileSync(join(dir, 'data.json'), 'utf8')) };
  }),
);

// The Docs column names the checkout that built the docs served, which `--docs` can point at.
const docsRepo = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: docsRoot, encoding: 'utf8' }).stdout?.trim();
const docsCommit = docsRepo ? sh('git', ['rev-parse', '--short', 'HEAD'], docsRepo) : 'unknown';
const docsDirty = docsRepo ? sh('git', ['status', '--porcelain', '--', 'scripts/llms', 'registry', 'registry.json', 'src/pages', 'README.md'], docsRepo) !== '' : false;
const claudeVersion = sh('claude', ['--version'], repo).split(' ')[0];
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = join(here, 'runs', `${stamp}${args.label ? `-${args.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}` : ''}`);
mkdirSync(outDir, { recursive: true });
const app = template();

/** One agent run of one task, start to finish. */
async function runOnce(task, n) {
  const runDir = join(outDir, task.name, `run-${n}`);
  mkdirSync(runDir, { recursive: true });
  const workspace = mkdtempSync(join(tmpdir(), 'lede-bench-'));
  cpSync(app, workspace, { recursive: true });
  mkdirSync(join(workspace, 'src', 'data'), { recursive: true });
  cpSync(join(task.dir, 'data.json'), join(workspace, 'src', 'data', task.module.dataFile));
  const docs = await serve({ root: docsRoot });

  // A fresh agent, with nothing from this machine's Claude Code setup and no web tools.
  const env = isolatedEnv();
  // A Stop hook records the effort Claude Code actually applied each turn, after any downgrade for the model, since
  // the transcript doesn't say. --bare skips hooks, so with an API key only the requested effort is known.
  const effortLog = join(runDir, 'effort.jsonl');
  const settings = JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: `{ cat; echo; } >> '${effortLog}'` }] }] } });
  const claudeArgs = [
    '-p', task.text.replaceAll('{{DOCS}}', docs.url),
    '--model', args.model,
    ...(args.effort ? ['--effort', args.effort] : []),
    '--output-format', 'stream-json', '--verbose',
    '--tools', TOOLS,
    '--permission-mode', 'bypassPermissions',
    '--settings', settings,
    '--max-budget-usd', args.budget,
    ...isolatedArgs(env),
  ];

  console.log(`${task.name} run ${n}: agent working in ${workspace}, docs at ${docs.url}`);
  const transcript = [];
  const exit = await new Promise((done) => {
    const child = spawn('claude', claudeArgs, { cwd: workspace, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => child.kill('SIGTERM'), Number(args.minutes) * 60_000);
    child.stdout.on('data', (chunk) => transcript.push(chunk));
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      done(signal ? `killed (${signal})` : code);
    });
  });
  const transcriptText = Buffer.concat(transcript).toString('utf8');
  writeFileSync(join(runDir, 'transcript.jsonl'), transcriptText);
  await docs.close();

  console.log(`${task.name} run ${n}: agent exited (${exit}). Building and checking…`);
  const agent = readTranscript(transcriptText, { docsUrl: docs.url, forbidden: [...new Set([repo, resolve(docsRoot, '..')])] });
  const docsRead = { ...readDocsLog(docs.log), log: docs.log };
  const lede = readLedeUse(workspace);
  const built = build(workspace);
  let checked;
  try {
    checked = await check(built.passed ? workspace : join(workspace, 'no-build'), runDir, {
      task: task.module,
      data: task.data,
      ownFiles: [...lede.ownFiles, ...lede.ownCss],
      ledeImports: lede.imported.length,
    });
  } catch (error) {
    checked = { checked: false, reason: String(error.message ?? error).split('\n')[0], checks: [] };
  }
  const graded = !args['no-grade'] && built.passed ? grade(runDir, task.text) : null;

  // Keep what the agent wrote, without packages or build output.
  cpSync(workspace, join(runDir, 'app'), { recursive: true, filter: (src) => !/[\\/](node_modules|dist|\.git)([\\/]|$)/.test(src) });
  rmSync(workspace, { recursive: true, force: true });
  rmSync(env.CLAUDE_CONFIG_DIR, { recursive: true, force: true });

  let applied = [];
  try {
    applied = readFileSync(effortLog, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line).effort?.level ?? 'unknown');
  } catch {}
  const effort = { requested: args.effort ?? 'default', applied: [...new Set(applied)] };
  const metrics = { task: task.name, run: n, exit, effort, score: score(checked.checks), agent, docs: docsRead, lede, build: built, check: checked, grade: graded };
  writeFileSync(join(runDir, 'metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`);
  const failed = checked.checks.filter((c) => !c.pass).map((c) => c.name);
  console.log(`${task.name} run ${n}: ${Math.round(metrics.score * 100)}% of checks pass${failed.length ? `; failing: ${failed.join('; ')}` : ''}${graded ? `; grader ${graded.mean?.toFixed(1)} of 5` : ''}`);
  return metrics;
}

const median = (values) => {
  const known = values.filter((v) => typeof v === 'number').sort((a, b) => a - b);
  if (!known.length) return null;
  const mid = Math.floor(known.length / 2);
  return known.length % 2 ? known[mid] : (known[mid - 1] + known[mid]) / 2;
};
const kb = (bytes) => (bytes == null ? '–' : `${Math.round(bytes / 1024)}`);
const fmt = (v, digits = 0) => (v == null ? '–' : v.toFixed(digits));

const rows = [];
const all = [];
for (const task of tasks) {
  const results = [];
  for (let n = 1; n <= Number(args.runs); n++) results.push(await runOnce(task, n));
  all.push(...results);
  // Contaminated runs knew more than the docs said, so they stay out of the medians.
  const clean = results.filter((r) => !r.agent.contaminated);
  const m = (pick) => median(clean.map(pick));
  const applied = [...new Set(results.flatMap((r) => r.effort.applied))].join('/') || '?';
  const requested = args.effort ?? 'default';
  const summary = {
    date: new Date().toISOString().slice(0, 10),
    label: args.label,
    docs: `${docsCommit}${docsDirty ? '+dirty' : ''}`,
    task: `${task.name}${task.module.holdout ? ' (held out)' : ''}`,
    model: args.model,
    effort: applied === requested ? applied : `${applied} (asked ${requested})`,
    claudeCode: claudeVersion,
    runs: results.length,
    clean: clean.length,
    score: m((r) => r.score),
    scoreRange: clean.length ? `${Math.round(Math.min(...clean.map((r) => r.score)) * 100)}–${Math.round(Math.max(...clean.map((r) => r.score)) * 100)}` : '–',
    grade: m((r) => r.grade?.mean),
    toolCalls: m((r) => r.agent.toolCallCount),
    docsFiles: m((r) => r.docs.files.length),
    docsBytes: m((r) => r.docs.bytes),
    notFound: m((r) => r.docs.notFound.length),
    costUsd: m((r) => r.agent.costUsd),
    minutes: m((r) => (r.agent.durationMs == null ? null : r.agent.durationMs / 60_000)),
  };
  rows.push(
    `| ${summary.date} | ${summary.label || '–'} | ${summary.docs} | ${summary.task} | ${summary.model} | ${summary.effort} | ${summary.claudeCode} | ${summary.clean}/${summary.runs} | ${summary.score == null ? '–' : Math.round(summary.score * 100)}% (${summary.scoreRange}) | ${fmt(summary.grade, 1)} | ${fmt(summary.toolCalls)} | ${fmt(summary.docsFiles)} | ${kb(summary.docsBytes)} | ${fmt(summary.notFound)} | ${fmt(summary.costUsd, 2)} | ${fmt(summary.minutes, 1)} |`,
  );
}

// Which checks failed across the batch, most often first: the list to read before changing the docs.
const failures = {};
for (const r of all) for (const c of r.check.checks) if (!c.pass) failures[`${r.task}: ${c.name}`] = (failures[`${r.task}: ${c.name}`] ?? 0) + 1;
writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify({ rows, failures }, null, 2)}\n`);
console.log(`\n${rows.join('\n')}\n\nFailing checks, by how many runs failed them:\n${Object.entries(failures).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${v}× ${k}`).join('\n') || '  none'}\n\nRuns are in ${outDir}`);
if (!args['no-record']) appendFileSync(join(here, 'results.md'), `${rows.join('\n')}\n`);
