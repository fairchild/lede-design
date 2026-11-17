#!/usr/bin/env node
// Runs the docs benchmark: a fresh Claude Code agent builds task.md's screen in a new Vite app, with this checkout's
// built docs as its only source on Lede. README.md says what it measures and how it stays fair.
//
//   npm run build && node benchmarks/docs-agent/run.mjs --runs 3 --label "before llms.txt change"
//
// Options: --model (claude-fable-5-2), --effort (Claude Code's default; the effort applied is recorded either way), --runs (1), --budget USD per run (8),
// --minutes per run (30), --label, --no-record (leave results.md alone).
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { serve } from './docs-server.mjs';
import { build, check, readDocsLog, readLedeUse, readTranscript } from './measure.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const CREATE_VITE = '9.3.4';
const TOOLS = 'Bash,Read,Write,Edit,Glob,Grep';

const { values: args } = parseArgs({
  options: {
    model: { type: 'string', default: 'claude-fable-5-2' },
    effort: { type: 'string' },
    runs: { type: 'string', default: '1' },
    budget: { type: 'string', default: '8' },
    minutes: { type: 'string', default: '30' },
    label: { type: 'string', default: '' },
    'no-record': { type: 'boolean', default: false },
  },
});

const docsRoot = join(repo, 'dist');
if (!existsSync(join(docsRoot, 'llms.txt'))) {
  console.error('No dist/llms.txt. Run `npm run build` first: the benchmark serves that build to the agent.');
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

const docsCommit = sh('git', ['rev-parse', '--short', 'HEAD'], repo);
const docsDirty = sh('git', ['status', '--porcelain', '--', 'scripts/llms', 'registry', 'registry.json', 'src/pages'], repo) !== '';
const claudeVersion = sh('claude', ['--version'], repo).split(' ')[0];
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = join(here, 'runs', `${stamp}${args.label ? `-${args.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}` : ''}`);
mkdirSync(outDir, { recursive: true });
const task = readFileSync(join(here, 'task.md'), 'utf8');
const app = template();

/** One agent run, start to finish. */
async function runOnce(n) {
  const runDir = join(outDir, `run-${n}`);
  mkdirSync(runDir, { recursive: true });
  const workspace = mkdtempSync(join(tmpdir(), 'lede-bench-'));
  cpSync(app, workspace, { recursive: true });
  const docs = await serve({ root: docsRoot });

  // A fresh agent: no settings, memory, CLAUDE.md, skills, MCP servers or web tools, and a config folder of its own
  // so nothing from this machine's Claude Code setup reaches it. With an API key, --bare drops the rest.
  const env = { ...process.env };
  // A parent Claude Code session passes its memory, skills and extra folders on through these, so they go too.
  for (const key of Object.keys(env)) {
    if (key === 'CLAUDECODE' || key === 'CLAUDE_EFFORT' || /^CLAUDE_.*(MEMORY|ADDITIONAL_DIRECTORIES|SYNC_SKILLS|SYNC_PLUGINS|SKILL)/.test(key)) delete env[key];
  }
  env.CLAUDE_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'lede-bench-config-'));
  // A Stop hook records the effort Claude Code actually applied each turn, after any downgrade for the model, since
  // the transcript doesn't say. --bare skips hooks, so with an API key only the requested effort is known.
  const effortLog = join(runDir, 'effort.jsonl');
  const settings = JSON.stringify({
    hooks: { Stop: [{ hooks: [{ type: 'command', command: `{ cat; echo; } >> '${effortLog}'` }] }] },
  });
  const claudeArgs = [
    '-p', task.replaceAll('{{DOCS}}', docs.url),
    '--model', args.model,
    ...(args.effort ? ['--effort', args.effort] : []),
    '--output-format', 'stream-json', '--verbose',
    '--tools', TOOLS,
    '--permission-mode', 'bypassPermissions',
    '--setting-sources', '',
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--no-session-persistence',
    '--settings', settings,
    '--max-budget-usd', args.budget,
    ...(env.ANTHROPIC_API_KEY ? ['--bare'] : []),
  ];

  console.log(`Run ${n}: agent working in ${workspace}, docs at ${docs.url}`);
  const transcriptPath = join(runDir, 'transcript.jsonl');
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
  writeFileSync(transcriptPath, transcriptText);
  await docs.close();

  console.log(`Run ${n}: agent exited (${exit}). Building and checking…`);
  const agent = readTranscript(transcriptText, { docsUrl: docs.url, forbidden: [repo] });
  const docsRead = { ...readDocsLog(docs.log), log: docs.log };
  const lede = readLedeUse(workspace);
  const built = build(workspace);
  let checked = { checked: false, reason: 'build failed' };
  if (built.passed) {
    try {
      checked = await check(workspace, join(runDir, 'screenshot.png'));
    } catch (error) {
      checked = { checked: false, reason: String(error.message ?? error).split('\n')[0] };
    }
  }

  // Keep what the agent wrote, without packages or build output.
  cpSync(workspace, join(runDir, 'app'), {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|dist|\.git)([\\/]|$)/.test(src),
  });
  rmSync(workspace, { recursive: true, force: true });
  rmSync(env.CLAUDE_CONFIG_DIR, { recursive: true, force: true });

  let applied = [];
  try {
    applied = readFileSync(effortLog, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line).effort?.level ?? 'unknown');
  } catch {}
  const effort = { requested: args.effort ?? 'default', applied: [...new Set(applied)] };
  const metrics = { run: n, exit, effort, agent, docs: docsRead, lede, build: built, check: checked };
  writeFileSync(join(runDir, 'metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`);
  return metrics;
}

const median = (values) => {
  const known = values.filter((v) => typeof v === 'number').sort((a, b) => a - b);
  if (!known.length) return null;
  const mid = Math.floor(known.length / 2);
  return known.length % 2 ? known[mid] : (known[mid - 1] + known[mid]) / 2;
};

const results = [];
for (let n = 1; n <= Number(args.runs); n++) results.push(await runOnce(n));

// Contaminated runs read Lede's checkout, so they stay out of the medians.
const clean = results.filter((r) => !r.agent.contaminated);
const m = (pick) => median(clean.map(pick));
const kb = (bytes) => (bytes == null ? '–' : `${Math.round(bytes / 1024)}`);
const fmt = (v, digits = 0) => (v == null ? '–' : v.toFixed(digits));
const summary = {
  date: new Date().toISOString().slice(0, 10),
  label: args.label,
  docs: `${docsCommit}${docsDirty ? '+dirty' : ''}`,
  model: args.model,
  // What Claude Code applied, from the Stop hook, with what was asked for when that differs or is unknown.
  effort: (() => {
    const applied = [...new Set(results.flatMap((r) => r.effort.applied))].join('/') || '?';
    const requested = args.effort ?? 'default';
    return applied === requested ? applied : `${applied} (asked ${requested})`;
  })(),
  claudeCode: claudeVersion,
  runs: results.length,
  clean: clean.length,
  toolCalls: m((r) => r.agent.toolCallCount),
  docsFiles: m((r) => r.docs.files.length),
  docsBytes: m((r) => r.docs.bytes),
  notFound: m((r) => r.docs.notFound.length),
  toolResultChars: m((r) => r.agent.toolResultChars),
  outputTokens: m((r) => r.agent.usage?.output),
  costUsd: m((r) => r.agent.costUsd),
  minutes: m((r) => (r.agent.durationMs == null ? null : r.agent.durationMs / 60_000)),
  builds: clean.filter((r) => r.build.passed).length,
  ledeImports: m((r) => r.lede.imported.length),
  axeViolations: m((r) => (r.check.checked ? r.check.axe.violations : null)),
};
writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify({ summary, results: results.map((r) => r.run) }, null, 2)}\n`);

const row = `| ${summary.date} | ${summary.label || '–'} | ${summary.docs} | ${summary.model} | ${summary.effort} | ${summary.claudeCode} | ${summary.clean}/${summary.runs} | ${fmt(summary.toolCalls)} | ${fmt(summary.docsFiles)} | ${kb(summary.docsBytes)} | ${fmt(summary.notFound)} | ${kb(summary.toolResultChars)} | ${fmt(summary.outputTokens)} | ${fmt(summary.costUsd, 2)} | ${fmt(summary.minutes, 1)} | ${summary.builds}/${summary.clean} | ${fmt(summary.ledeImports)} | ${fmt(summary.axeViolations)} |`;
console.log(`\n${row}\n\nRuns are in ${outDir}`);
if (!args['no-record']) appendFileSync(join(here, 'results.md'), `${row}\n`);
