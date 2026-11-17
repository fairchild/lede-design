// Checks a built design system before it's published: each card's preview loads the way the design system page loads
// it (the stylesheet, React from components/lib/ and components/bundle.js first), and every sample and variant mounts
// with no error, no warning, no request outside the system and no focus taken. Run `npm run design-system` first, then
// `npm run design-system:check`. PW_CHROMIUM picks a Chromium, as for `npm test`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, normalize } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = 'dist-design-system/project';
const PORT = Number(process.env.DS_CHECK_PORT ?? 4599);
if (!existsSync(join(ROOT, 'design-system.json'))) throw new Error(`No design system at ${ROOT}: run npm run design-system first.`);
const { libraries } = JSON.parse(readFileSync(join(ROOT, 'design-system.json'), 'utf8'));

// What the page loads before a preview's own document, and the first theme it sets.
const preload = [
  '<link rel="stylesheet" href="/components/bundle.css">',
  ...libraries.map((lib) => `<script src="/${lib.file}"></script>`),
  '<script src="/components/bundle.js"></script>',
].join('');
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const outside = [];
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  // The browser asks for a favicon on its own; a preview doesn't.
  if (path === '/favicon.ico') {
    res.statusCode = 204;
    return res.end();
  }
  const file = join(ROOT, path);
  if (!existsSync(file)) {
    outside.push(path);
    res.statusCode = 404;
    return res.end();
  }
  let body = readFileSync(file, 'utf8');
  if (path.endsWith('preview.html')) body = body.replace('<head>', `<head>${preload}`).replace(/<html\b/, '<html data-theme="light"');
  res.setHeader('content-type', TYPES[path.slice(path.lastIndexOf('.'))] ?? 'text/plain');
  res.end(body);
});
await new Promise((resolve) => server.listen(PORT, resolve));

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const cards = readdirSync(join(ROOT, 'components')).filter((name) => name !== 'Cover' && existsSync(join(ROOT, 'components', name, 'preview.html')));
const failures = [];
try {
  for (const card of cards) {
    const page = await browser.newPage();
    const problems = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) problems.push(message.text());
    });
    page.on('request', (request) => {
      if (!request.url().startsWith(`http://localhost:${PORT}/`)) problems.push(`requests ${request.url()}`);
    });
    outside.length = 0;
    await page.goto(`http://localhost:${PORT}/components/${card}/preview.html`);
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => {
      const roots = [...document.querySelectorAll('[id^="ds-"]')];
      const mounted = roots.filter((el) => Object.keys(el).some((key) => key.startsWith('__reactContainer'))).length;
      return { roots: roots.length, mounted, focused: document.activeElement === document.body ? null : document.activeElement?.outerHTML.slice(0, 80) };
    });
    if (!state.roots) problems.push('no mount point');
    if (state.mounted < state.roots) problems.push(`${state.mounted} of ${state.roots} mounted`);
    if (state.focused) problems.push(`took focus: ${state.focused}`);
    for (const path of outside) problems.push(`requests ${path}, which the system doesn't have`);
    if (problems.length) failures.push(`${card}: ${problems.join('; ')}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(`design-system:check: ${failures.length} of ${cards.length} previews fail\n${failures.map((f) => `  ${f}`).join('\n')}`);
  process.exit(1);
}
console.log(`design-system:check: all ${cards.length} previews mount, with no errors, requests or focus`);
