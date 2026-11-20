// Measures one finished run: what the transcript says the agent did, what it read from the docs server, and what it
// left behind. The harness builds and checks the app itself, so nothing here takes the agent's word.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { serve } from './docs-server.mjs';
import { axe, ok, pageChecks, safely, sourceChecks } from './checks.mjs';

/**
 * Reads Claude Code's stream-json output.
 * @param {string} text one JSON event per line
 * @param {{ docsUrl: string, forbidden: string[] }} context
 */
export function readTranscript(text, { docsUrl, forbidden }) {
  const toolCalls = {};
  const commands = [];
  const inputs = [];
  let toolResultChars = 0;
  // Claude Code ends a turn with a result event, and a background command finishing afterwards starts another turn
  // with its own. Each result's cost is the running total; its turns, time and tokens are that turn's alone.
  const results = [];
  const leaks = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === 'system' && event.subtype === 'init') {
      if (event.skills?.length) leaks.push(`skills: ${event.skills.join(', ')}`);
      if (event.mcp_servers?.length) leaks.push(`MCP servers: ${event.mcp_servers.map((s) => s.name ?? s).join(', ')}`);
    } else if (event.type === 'system' && event.subtype === 'memory_recall' && event.memories?.length) {
      leaks.push(`memory: ${event.memories.map((m) => m.path).join(', ')}`);
    } else if (event.type === 'assistant') {
      for (const block of event.message?.content ?? []) {
        if (block.type !== 'tool_use') continue;
        toolCalls[block.name] = (toolCalls[block.name] ?? 0) + 1;
        inputs.push(JSON.stringify(block.input ?? {}));
        if (block.name === 'Bash' && typeof block.input?.command === 'string') commands.push(block.input.command);
      }
    } else if (event.type === 'user') {
      for (const block of event.message?.content ?? []) {
        if (block.type !== 'tool_result') continue;
        const content = block.content;
        toolResultChars += typeof content === 'string'
          ? content.length
          : (content ?? []).reduce((sum, part) => sum + (part.text?.length ?? 0), 0);
      }
    } else if (event.type === 'result') {
      results.push(event);
    }
  }

  // Any URL the agent asked for that isn't the docs server, its own app on localhost, or npm, which installs packages.
  const urls = commands.flatMap((command) => command.match(/https?:\/\/[^\s'"`)<>]+/g) ?? []);
  const external = [...new Set(urls.filter((url) => !url.startsWith(docsUrl) && !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]|registry\.npmjs\.org/.test(url)))];
  // A run that touched Lede's own checkout, or was handed memory, skills or MCP servers, knew more than the docs said.
  for (const path of forbidden) if (inputs.some((input) => input.includes(path))) leaks.push(`read ${path}`);
  const contaminated = leaks.length > 0;
  const result = results.at(-1);
  const sum = (pick) => results.reduce((total, r) => total + (pick(r) ?? 0), 0);

  return {
    toolCalls,
    toolCallCount: Object.values(toolCalls).reduce((sum, n) => sum + n, 0),
    toolResultChars,
    external,
    contaminated,
    leaks,
    finished: result ? !result.is_error : false,
    stop: result?.subtype ?? 'no result',
    results: results.length,
    turns: result ? sum((r) => r.num_turns) : null,
    costUsd: result?.total_cost_usd ?? null,
    durationMs: result ? sum((r) => r.duration_ms) : null,
    usage: result
      ? {
          input: sum((r) => r.usage?.input_tokens),
          cacheRead: sum((r) => r.usage?.cache_read_input_tokens),
          cacheWrite: sum((r) => r.usage?.cache_creation_input_tokens),
          output: sum((r) => r.usage?.output_tokens),
        }
      : null,
    reply: typeof result?.result === 'string' ? result.result.slice(0, 500) : null,
  };
}

/**
 * Splits what the docs server sent into pages, which the agent read, and registry files, which shadcn fetched to
 * install items.
 * @param {{ path: string, status: number, bytes: number }[]} log
 */
export function readDocsLog(log) {
  const ok = log.filter((entry) => entry.status === 200);
  const pages = ok.filter((entry) => !entry.path.startsWith('/r/'));
  const registry = ok.filter((entry) => entry.path.startsWith('/r/'));
  const distinct = (entries) => [...new Set(entries.map((entry) => entry.path))];
  return {
    requests: log.length,
    files: distinct(pages),
    bytes: pages.reduce((sum, entry) => sum + entry.bytes, 0),
    registryFiles: distinct(registry),
    notFound: distinct(log.filter((entry) => entry.status === 404)),
  };
}

function listFiles(dir, skip = new Set(['node_modules', 'dist', '.git'])) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (skip.has(name)) return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full, skip) : [full];
  });
}

/** Which Lede files the app has, and which of them its own code imports. */
export function readLedeUse(workspace) {
  const src = join(workspace, 'src');
  const all = listFiles(src);
  const installed = all
    .filter((file) => /[\\/]components[\\/]lede[\\/][^\\/]+\.tsx?$/.test(file))
    .map((file) => relative(src, file));
  const own = all.filter((file) => /\.(tsx?|jsx?)$/.test(file) && !/[\\/]components[\\/]lede[\\/]/.test(file));
  // CSS counts only when the app's code imports it, so the template's unused App.css doesn't.
  const imported = own.map((file) => readFileSync(file, 'utf8')).join('\n');
  const css = all.filter((file) => /\.css$/.test(file) && !/[\\/]styles[\\/]lede[\\/]/.test(file) && [`/${basename(file)}'`, `/${basename(file)}"`].some((end) => imported.includes(end)));
  const imports = new Set();
  for (const file of own) {
    for (const match of readFileSync(file, 'utf8').matchAll(/from\s+['"](@\/components\/lede\/[^'"]+)['"]/g)) {
      imports.add(match[1]);
    }
  }
  return {
    installed: installed.length,
    imported: [...imports].sort(),
    ownFiles: own.map((file) => relative(workspace, file)),
    ownCss: css.map((file) => relative(workspace, file)),
    ownLines: own.reduce((sum, file) => sum + readFileSync(file, 'utf8').split('\n').length, 0),
  };
}

/** Runs the app's own build. */
export function build(workspace) {
  const run = spawnSync('npm', ['run', 'build'], { cwd: workspace, encoding: 'utf8', timeout: 300_000 });
  return { passed: run.status === 0, tail: `${run.stdout ?? ''}${run.stderr ?? ''}`.split('\n').slice(-30).join('\n') };
}

/**
 * Serves the built app and runs every scripted check: the task's own, at desktop and phone width, then the shared ones
 * for the page, axe on each screen it reaches (light, after the task's steps, phone and dark) and the app's source.
 * Screenshots of each screen go to `runDir` for the grader and for people.
 * @param {string} workspace @param {string} runDir @param {{ task: object, data: object }} context
 */
export async function check(workspace, runDir, { task, data, ownFiles, ledeImports }) {
  const dist = join(workspace, 'dist');
  const checks = [];
  const source = sourceChecks(ownFiles.map((file) => join(workspace, file)), ledeImports);
  if (!existsSync(join(dist, 'index.html'))) {
    return { checked: false, reason: 'no dist/index.html', checks: [ok('builds', false), ...source] };
  }
  const { chromium } = await import('@playwright/test');
  const server = await serve({ root: dist, rewriteOrigin: false });
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const errors = [];
  const open = async (options) => {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(String(error.message ?? error)));
    await page.goto(server.url, { waitUntil: 'networkidle' });
    return page;
  };
  try {
    checks.push(ok('builds', true));
    const desktop = await open({ viewport: { width: 1280, height: 800 } });
    const text = (await desktop.locator('body').innerText()).trim();
    checks.push(ok('desktop: renders text', text.length > 0, `${text.length} characters`));
    await desktop.screenshot({ path: join(runDir, 'desktop.png') });
    checks.push(await axe(desktop, 'desktop'), ...(await pageChecks(desktop, 'desktop')));
    checks.push(...(await safely(() => task.desktop(desktop, data)) ?? [ok('the task checks ran on desktop', false)]));
    await desktop.screenshot({ path: join(runDir, 'desktop-after.png') });
    checks.push(await axe(desktop, 'desktop after the task steps'));

    const phone = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await phone.screenshot({ path: join(runDir, 'phone.png') });
    checks.push(await axe(phone, 'phone'), ...(await pageChecks(phone, 'phone')));
    if (task.phone) {
      checks.push(...(await safely(() => task.phone(phone, data)) ?? [ok('the task checks ran on a phone', false)]));
      await phone.screenshot({ path: join(runDir, 'phone-after.png') });
    }

    const dark = await open({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
    await dark.screenshot({ path: join(runDir, 'dark.png') });
    checks.push(await axe(dark, 'dark'));
    checks.push(ok('no errors in the page', errors.length === 0, errors.slice(0, 3).join(' | ')));
    checks.push(...source);
    return { checked: true, pageErrors: errors, checks };
  } finally {
    await browser.close();
    await server.close();
  }
}

/** The share of checks that pass, from 0 to 1. */
export const score = (checks) => (checks.length ? checks.filter((c) => c.pass).length / checks.length : 0);
