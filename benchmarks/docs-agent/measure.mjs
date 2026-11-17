// Measures one finished run: what the transcript says the agent did, what it read from the docs server, and what it
// left behind. The harness builds and checks the app itself, so nothing here takes the agent's word.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { serve } from './docs-server.mjs';

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
    ownLines: own.reduce((sum, file) => sum + readFileSync(file, 'utf8').split('\n').length, 0),
  };
}

/** Runs the app's own build. */
export function build(workspace) {
  const run = spawnSync('npm', ['run', 'build'], { cwd: workspace, encoding: 'utf8', timeout: 300_000 });
  return { passed: run.status === 0, tail: `${run.stdout ?? ''}${run.stderr ?? ''}`.split('\n').slice(-30).join('\n') };
}

/** Serves the built app, takes a screenshot and runs axe on its first screen, in whatever theme the app starts in. */
export async function check(workspace, screenshotPath) {
  const dist = join(workspace, 'dist');
  if (!existsSync(join(dist, 'index.html'))) return { checked: false, reason: 'no dist/index.html' };
  const { chromium } = await import('@playwright/test');
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const server = await serve({ root: dist, rewriteOrigin: false });
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.message ?? error)));
    await page.goto(server.url, { waitUntil: 'networkidle' });
    await page.screenshot({ path: screenshotPath });
    const text = (await page.locator('body').innerText()).trim();
    const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
    const first = await new AxeBuilder({ page }).withTags(tags).analyze();
    return {
      checked: true,
      renders: text.length > 0,
      textChars: text.length,
      pageErrors: errors,
      axe: {
        violations: first.violations.length,
        nodes: first.violations.reduce((sum, v) => sum + v.nodes.length, 0),
        rules: first.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length})`),
      },
    };
  } finally {
    await browser.close();
    await server.close();
  }
}
