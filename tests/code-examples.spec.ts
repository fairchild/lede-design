import { readFileSync } from 'node:fs';
import { test, expect, type Locator, type Page } from '@playwright/test';
import { tokenize } from '../src/pages/docs/tokenize';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

const CLIENT = 'Code for a client-mode table';
const SERVER = 'Code for a server-mode table';
const PAGES = { '/': 'Overview', '/components': 'Components', '/blocks/data-table': 'DataTablePage' };
const OPEN_ON_ARRIVAL = { '/': ['Install commands', 'CSS import', 'Import a component', 'Wrap your app', 'React Router adapter'], '/components': ['Theming a local overlay'], '/blocks/data-table': [CLIENT] };
const ROUTES = Object.keys(PAGES) as (keyof typeof PAGES)[];

const example = (page: Page, label: string) => page.locator('.docs-code-example').filter({ has: page.getByRole('button', { name: label }) });
/** The examples a page writes itself. Each section's install command and sample come from `usage.spec.ts`'s sources. */
const OWN = '.docs-code-example:not(.docs-usage > *)';
const trigger = (block: Locator) => block.getByRole('button');

async function openAll(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // panels open at once, at full height
  const closed = page.locator('.docs-code-example').getByRole('button', { expanded: false });
  while (await closed.count()) await closed.first().click();
}

/**
 * The examples a page's source passes in, as [label, code]: `label="…"` and an `…_CODE` constant on one line. The
 * constant is a template literal, or a sample file imported as text.
 */
function sourceExamples(route: keyof typeof PAGES) {
  const source = readFileSync(`src/pages/docs/${PAGES[route]}.tsx`, 'utf8');
  const constants = new Map(
    [...source.matchAll(/const (\w+_CODE) = `([\s\S]*?[^\\])`;/g)].map(([, name, text]) => [
      name,
      text.replaceAll('${REGISTRY}', `https://lede.cloudcompute.com/r/v${version}/{name}.json`).replace(/\\([`$\\])/g, '$1').trim(),
    ]),
  );
  for (const [, name, file] of source.matchAll(/^import (\w+_CODE) from '\.\/((?:samples|examples)\/[\w-]+\.tsx)\?raw';$/gm)) {
    constants.set(name, readFileSync(`src/pages/docs/${file}`, 'utf8').trim());
  }
  const fromSource = [...source.matchAll(/label="([^"]+)"[^\n]*?\b(\w+_CODE)\b/g)].map(([, label, name]) => [label, constants.get(name)!] as const);
  return route === '/' ? [...fromSource, ...readmeExamples()] : fromSource;
}

/** Overview shows the README's install steps after its first: each fenced block from step 2 on, dedented, by its label. */
function readmeExamples() {
  const steps = readFileSync('README.md', 'utf8').split('## Use it in a shadcn project')[1].split('\nTo move to a later release')[0];
  const fences = [...steps.split(/^2\. /m)[1].matchAll(/^ {3}```(\w*)\n([\s\S]*?)\n {3}```$/gm)].map(([, language, code]) => ({ language, code: code.replace(/^ {3}/gm, '') }));
  const labels = ['CSS import', 'Import a component', 'Wrap your app', 'React Router adapter'];
  // Overview names each block by its step, so the README's order is part of what the labels describe.
  expect(fences.map((f) => f.language)).toEqual(['css', 'tsx', 'tsx', 'tsx']);
  return fences.map(({ code }, i) => [labels[i], code] as const);
}

for (const route of ROUTES) {
  test(`${route}: every example shows its source, character for character`, async ({ page }) => {
    await page.goto(route);
    const expected = sourceExamples(route);
    expect(expected.length).toBeGreaterThan(0);
    await expect(page.locator(OWN)).toHaveCount(expected.length);
    for (const [label, code] of expected) expect(await example(page, label).locator('code').textContent()).toBe(code);
  });

  test(`${route}: starts open where the code is the point`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('.docs-code-example').first()).toBeVisible();
    const open = page.locator('.docs-code-example').filter({ has: page.getByRole('button', { expanded: true }) });
    const labels = await open.locator('.ld-disc-title').allTextContents();
    expect(labels).toEqual(OPEN_ON_ARRIVAL[route]);
  });

  test(`${route}: fits a 320px screen with every example open`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(route);
    await openAll(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    for (const pre of await page.locator('.docs-code').all()) {
      if (await pre.evaluate((el) => el.scrollWidth > el.clientWidth)) await expect(pre).toHaveRole('region');
    }
  });
}

// Some of these colour wrongly, which is harmless. None may lose or reorder a character.
test('The tokenizer keeps every character of awkward input', () => {
  const awkward = [
    '', ' ', '\n\n', "it's", '<', '</', '<a b="', '`${`', '/* open', '// a\r\nb', "'\\", '#', '# a', '--flag', '"\\"',
    '`x ${b ? `c ${d}` : \'e\'} f`', '`${`${`deep`}`}`', '`open ${b}', '\\`escaped\\`',
    "'https://example.com/a'; // b", '`https://${host}//c`', '<a href="https://example.com">x // y</a>',
    'useState<View>({})', '<T,>(x: T) => x', 'a<b && c>d', 'a < b > c', '<></>', '<Foo.Bar<T> a={b < c} />',
    "/it's/.test(s)", '/"/g', '/`/', '/\\/\\//', '/[/*]/; a; /* b */', "<p>Don't stop, won't stop</p>",
    "echo 'open", 'echo "open', 'echo "a\\"b" \'c\\\'d', "echo 'multi\nline'", 'echo a#b # c', 'curl -fsSL https://example.com/#a --b=c',
  ];
  for (const language of ['tsx', 'shell', 'css'] as const) {
    for (const code of awkward) expect(tokenize(code, language).map((t) => t.text).join('')).toBe(code);
  }
});

test('A closed example opens and closes from the keyboard', async ({ page }) => {
  await page.goto('/blocks/data-table');
  const block = example(page, SERVER);
  const code = block.locator('code');
  await expect(trigger(block)).toHaveAttribute('aria-expanded', 'false');
  await expect(code).toBeHidden();
  await trigger(block).focus();
  await page.keyboard.press('Enter');
  await expect(trigger(block)).toHaveAttribute('aria-expanded', 'true');
  await expect(code).toBeVisible();
  await page.keyboard.press('Space');
  await expect(trigger(block)).toHaveAttribute('aria-expanded', 'false');
  await expect(code).toBeHidden();
});

test('TSX and shell are highlighted, in colours the plain text doesn’t use', async ({ page }) => {
  await page.goto('/blocks/data-table');
  const tsx = example(page, CLIENT).locator('code');
  const plain = await tsx.evaluate((el) => getComputedStyle(el).color);
  const samples: [string, string][] = [['keyword', 'import'], ['string', "'@/components"], ['comment', '//'], ['tag', 'DataTable']];
  for (const [kind, text] of samples) {
    const token = tsx.locator(`.docs-tk-${kind}`, { hasText: text }).first();
    await expect(token).toBeVisible();
    expect(await token.evaluate((el) => getComputedStyle(el).color)).not.toBe(plain);
  }
  await page.goto('/');
  const shell = example(page, 'Install commands').locator('code');
  await expect(shell.locator('.docs-tk-keyword').first()).toHaveText('npx');
  await expect(shell.locator('.docs-tk-string')).toContainText('@lede=');
});

test('Highlighting takes no room of its own', async ({ page }) => {
  await page.goto('/blocks/data-table');
  await openAll(page);
  for (const pre of await page.locator('.docs-code').all()) {
    const unmoved = await pre.evaluate((el) => {
      const size = () => [el.getBoundingClientRect().height, el.scrollWidth];
      const highlighted = size();
      const code = el.querySelector('code')!;
      code.textContent = code.textContent; // the same text with no spans
      return String(highlighted) === String(size());
    });
    expect(unmoved).toBe(true);
  }
});

test('A long example scrolls from the keyboard, a short one is no tab stop', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/blocks/data-table');
  const block = example(page, SERVER);
  await trigger(block).click();
  const region = block.getByRole('region', { name: SERVER });
  await region.focus();
  await expect(region).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/components');
  const short = example(page, 'Theming a local overlay').locator('pre');
  await expect(short).toBeVisible();
  await expect(short).not.toHaveAttribute('tabindex');
  await expect(short).not.toHaveRole('region');
});

test('A closed example is out of the tab order', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/blocks/data-table');
  const block = example(page, SERVER);
  await trigger(block).focus();
  await page.keyboard.press('Tab');
  expect(await block.evaluate((el) => el.contains(document.activeElement))).toBe(false);
});

// A test can't press Ctrl+F. A text fragment link reveals a hidden="until-found" panel, which is what find-in-page relies on.
test('A text fragment link opens a closed example', async ({ page }) => {
  await page.goto('/blocks/data-table');
  const block = example(page, SERVER);
  await expect(block.locator('[hidden="until-found"]')).toContainText('useServerRows');
  await page.goto('/blocks/data-table#:~:text=fetchCount');
  await expect(trigger(block)).toHaveAttribute('aria-expanded', 'true');
  await expect(block.locator('code')).toBeVisible();
});

test('A printed page shows every example in full', async ({ page }) => {
  await page.goto('/blocks/data-table');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.ld-shell-tabbar')).toBeHidden();
  for (const pre of await page.locator('.docs-code').all()) {
    await expect(pre).toBeVisible();
    expect(await pre.evaluate((el) => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().height > 18)).toBe(true);
  }
});

test('Forced colours flatten the highlighting into readable text', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/blocks/data-table');
  const code = example(page, CLIENT).locator('code');
  const colours = await code.evaluate((el) => {
    const read = (e: Element) => getComputedStyle(e).color;
    return { plain: read(el), tokens: [...new Set([...el.querySelectorAll('span')].map(read))] };
  });
  expect(colours.tokens).toEqual([colours.plain]);
});
