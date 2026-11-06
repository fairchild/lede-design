import { readdirSync, readFileSync } from 'node:fs';
import { createElement as h, Fragment, type ReactElement, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { Button, Checkbox, ThemeProvider, ThemeScope, type ThemeProviderProps } from '../registry/lede/index';

interface Token { name: string; value: string | Record<string, string> }
interface Group { tokens?: Token[] }
const tokens = JSON.parse(readFileSync('tokens/tokens.json', 'utf8')) as Record<string, Group>;
const css = readFileSync('registry/lede/lede.components.css', 'utf8');

// Every custom property the token build emits, read from its output so this follows the build's naming (Tailwind's
// @theme blocks aside, which aren't custom properties at runtime), plus what the registry CSS derives once per theme scope.
const emitted = readFileSync('registry/lede/lede.tokens.css', 'utf8').replace(/@theme[^{]*\{[^}]*\}/g, '');
const NAMES = [...new Set([
  ...[...emitted.matchAll(/(--[\w-]+):/g)].map((m) => m[1]),
  ...[...css.matchAll(/\[data-theme\][^{}]*\{([^}]*)\}/g)].flatMap((block) => [...block[1].matchAll(/(--[\w-]+):/g)].map((m) => m[1])),
])];

function tokenValue(name: string, theme: string): string {
  const { value } = tokens.color.tokens!.find((t) => t.name === name)!;
  const raw = typeof value === 'string' ? value : value[theme];
  return /^\{.+\}$/.test(raw) ? tokenValue(raw.slice(1, -1), theme) : raw;
}

// The site's own theme moves accent, shape and density off the token defaults, so a surface that fell back to them shows up.
// The panel's `tokens` override is a colour, which each [data-theme] block resets, so it stops at the nested provider.
const SITE = { accent: 'pink', shape: 'crisp', compact: true };
// WI-1007 is a table row on this page and a ListRow card in its narrow demo, and each opens its own menu, so `within` picks one.
const WORK_ITEM = { route: '/blocks/data-table', title: 'WI-1007', plain: 'Assign to me', critical: 'Delete', dark: (page: boolean) => page, accent: 'pink', accentForeground: 'primary-foreground', popover: 'popover', menuRadius: '4px' };
const SCOPES: Array<typeof WORK_ITEM & { within?: string }> = [
  { route: '/components', title: 'Weekly summary', plain: 'Archive', critical: 'Delete', dark: (page: boolean) => page, accent: 'pink', accentForeground: 'primary-foreground', popover: 'popover', menuRadius: '4px' },
  { route: '/components', title: 'Draft proposal', plain: 'Archive', critical: 'Delete', dark: () => true, accent: 'orange', accentForeground: 'background', popover: 'background', menuRadius: '2px' },
  { route: '/components', title: 'Shared notes', plain: 'Archive', critical: 'Delete', dark: () => true, accent: 'orange', accentForeground: 'background', popover: 'popover', menuRadius: '2px' },
  { ...WORK_ITEM, within: 'table' },
  { ...WORK_ITEM, within: '.ld-dt-cards' },
];
const MODES = [
  { name: 'light', dark: false, hc: false },
  { name: 'dark', dark: true, hc: false },
  { name: 'light-hc', dark: false, hc: true },
  { name: 'dark-hc', dark: true, hc: true },
];

async function visit(page: Page, prefs: Record<string, unknown>, dark = false, route = '/components') {
  await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
  await page.addInitScript((p) => localStorage.setItem('lede:appearance', JSON.stringify(p)), prefs);
  await page.goto(route);
}

async function openMenu(page: Page, title: string, within = 'body') {
  const trigger = page.locator(within).getByRole('button', { name: `More actions for ${title}` });
  // Playwright would centre the row, on a point axe samples for a modal. The backdrop has a hole at the trigger, so a ••• there reads as no modal open.
  await trigger.evaluate((el) => el.scrollIntoView());
  if (await page.evaluate(() => matchMedia('(hover: none)').matches)) {
    await trigger.tap();
  } else {
    await trigger.hover();
    await trigger.click();
  }
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await menu.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  return { menu, wrapper: trigger.locator('xpath=ancestor::*[@data-theme][1]') };
}

const read = (el: Locator): Promise<Record<string, string>> => el.evaluate((node, names) => {
  const style = getComputedStyle(node);
  return { ...Object.fromEntries(names.map((n) => [n, style.getPropertyValue(n)])), 'color-scheme': style.colorScheme };
}, NAMES);

// `region` wants all content in a landmark and exempts dialogs but not menus, so this adds menus to its exemptions.
// The rule stays on for everything else. axe reads `checks` at runtime, but its RunOptions type omits it.
const regionMatcher = 'dialog, [role=dialog], [role=alertdialog], svg, [role=menu]';
const axeOptions = { checks: { region: { options: { regionMatcher } } } } as Parameters<AxeBuilder['options']>[0];

async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).options(axeOptions).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

const asComputed = (page: Page, colour: string) => page.evaluate((c) => {
  const probe = document.createElement('i');
  probe.style.color = c;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}, colour);

test.describe('Portalled overlays', () => {
  for (const mode of MODES) {
    for (const scope of SCOPES) {
      test(`take their provider's theme · ${mode.name} · ${scope.title}${scope.within ? ` in ${scope.within}` : ''}`, async ({ page }) => {
        const theme = `${scope.dark(mode.dark) ? 'dark' : 'light'}${mode.hc ? '-hc' : ''}`;
        await visit(page, { ...SITE, highContrast: mode.hc }, mode.dark, scope.route);
        const { menu, wrapper } = await openMenu(page, scope.title, scope.within);

        const surface = await read(menu);
        expect(surface).toEqual(await read(wrapper));
        for (const [name, value] of Object.entries(surface)) expect(value, name).not.toBe('');

        const portalRoot = menu.locator('xpath=ancestor::*[@data-theme][1]');
        for (const property of ['color', 'font-family']) {
          await expect(portalRoot).toHaveCSS(property, await wrapper.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property));
        }

        expect(await asComputed(page, surface['--primary'])).toBe(await asComputed(page, tokenValue(`preset-${scope.accent}`, theme)));
        expect(surface['color-scheme']).toBe(theme.split('-')[0]);
        expect(await asComputed(page, surface['--primary-foreground'])).toBe(await asComputed(page, tokenValue(scope.accentForeground, theme)));
        await expect(menu).toHaveCSS('background-color', await asComputed(page, tokenValue(scope.popover, theme)));
        await expect(menu).toHaveCSS('color', await asComputed(page, tokenValue('popover-foreground', theme)));
        await expect(menu).toHaveCSS('border-radius', scope.menuRadius);

        const item = page.getByRole('menuitem', { name: scope.plain });
        await item.hover();
        await expect(item).toHaveAttribute('data-highlighted');
        await expect(item).toHaveCSS('background-color', await asComputed(page, tokenValue('accent', theme)));
        await expect(item).toHaveCSS('color', await asComputed(page, tokenValue('accent-foreground', theme)));
        await expect(item).toHaveCSS('min-height', '30px');

        expect(await axeViolations(page)).toEqual([]);
        const critical = page.getByRole('menuitem', { name: scope.critical });
        await expect(critical).toHaveCSS('color', await asComputed(page, tokenValue('destructive', theme)));
        await critical.hover();
        await expect(critical).toHaveAttribute('data-highlighted');
        await expect(critical).toHaveCSS('color', await asComputed(page, surface['--ld-destructive-on-tint']));
        expect(await axeViolations(page)).toEqual([]);

        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden();
      });
    }
  }

  for (const solidGlass of [false, true]) {
    test(`take the provider's glass · ${solidGlass ? 'solid' : 'regular'}`, async ({ page }) => {
      await visit(page, { solidGlass });
      for (const { route, within, title } of SCOPES) {
        await page.goto(route);
        const { menu } = await openMenu(page, title, within);
        const glass = await menu.evaluate((el) => {
          const probe = document.createElement('div');
          probe.className = 'ld-glass';
          el.append(probe);
          const { backdropFilter, backgroundColor } = getComputedStyle(probe);
          const card = getComputedStyle(el).getPropertyValue('--card');
          probe.remove();
          return { backdropFilter, backgroundColor, card };
        });
        if (solidGlass) {
          expect(glass.backdropFilter).toBe('none');
          expect(glass.backgroundColor).toBe(await asComputed(page, glass.card));
        } else {
          expect(glass.backdropFilter).toContain('blur');
        }
        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden();
      }
    });
  }

  test('add no page background and take no space', async ({ page }) => {
    await visit(page, SITE);
    const { menu } = await openMenu(page, 'Shared notes');
    const scopes = await page.locator('[data-theme]').filter({ has: menu }).evaluateAll((els) => els.map((el) => ({
      background: getComputedStyle(el).backgroundColor,
      height: el.getBoundingClientRect().height,
    })));
    expect(scopes).toEqual(Array(3).fill({ background: 'rgba(0, 0, 0, 0)', height: 0 }));
  });
});

test('A nested provider inherits its parent\'s accent and follows its parent\'s theme', async ({ page }) => {
  await visit(page, SITE);
  const panel = page.locator('[data-theme]').filter({ hasText: 'Draft proposal' }).last();
  const nested = page.locator('[data-theme]').filter({ hasText: 'Shared notes' }).last();
  const primary = async (el: Locator) => asComputed(page, await el.evaluate((node) => getComputedStyle(node).getPropertyValue('--primary')));

  expect(await primary(nested)).toBe(await asComputed(page, tokenValue('preset-orange', 'dark')));
  await expect(panel).toHaveAttribute('data-theme', 'dark');
  await expect(nested).toHaveAttribute('data-theme', 'dark');

  await page.emulateMedia({ contrast: 'more' });
  await expect(page.locator('.app-root')).toHaveAttribute('data-theme', 'light-hc');
  await expect(panel).toHaveAttribute('data-theme', 'dark-hc');
  await expect(nested).toHaveAttribute('data-theme', 'dark-hc');
  expect(await primary(nested)).toBe(await asComputed(page, tokenValue('preset-orange', 'dark-hc')));
});

const installedTheme = () => (JSON.parse(readFileSync('public/r/lede-theme.json', 'utf8')) as { files: Array<{ content: string }> })
  .files.map((f) => f.content).join('\n');

test('The installed theme carries color-scheme', () => {
  expect(installedTheme()).toMatch(/\[data-theme\^="dark"\][^{]*\{\s*color-scheme: dark;/);
});

test('The .dark and .light classes set color-scheme without data-theme', async ({ page }) => {
  await page.goto('/components');
  const schemes = await page.evaluate(() => ['dark', 'light'].map((name) => {
    const probe = document.createElement('div');
    probe.className = name;
    document.body.append(probe);
    const scheme = getComputedStyle(probe).colorScheme;
    probe.remove();
    return scheme;
  }));
  expect(schemes).toEqual(['dark', 'light']);
});

// A portal renders outside its provider's wrapper, so an overlay without ThemeScope silently loses its theme.
test('Every portal in the registry has ThemeScope directly inside it', () => {
  const files = readdirSync('registry', { recursive: true, encoding: 'utf8' }).filter((file) => /\.tsx?$/.test(file));
  const portals = files.flatMap((file) => [...readFileSync(`registry/${file}`, 'utf8').matchAll(/<(\w+\.Portal)\b[^>]*>\s*(<\w+)?/g)]
    .map((match) => ({ file, portal: match[1], inside: match[2] })));
  expect(portals.map((p) => p.file)).toContain('lede/list.tsx');
  expect(portals.filter((p) => p.inside !== '<ThemeScope')).toEqual([]);
  expect(files.filter((file) => readFileSync(`registry/${file}`, 'utf8').includes('createPortal'))).toEqual([]);
});

// A prop's options, read from its type, so a new option can't skip these checks.
const optionsOf = (prop: string) => [...new RegExp(`\\b${prop}\\?: ([^;]+);`).exec(readFileSync('registry/lede/theme-provider.tsx', 'utf8'))![1].matchAll(/'(\w+)'/g)].map((m) => m[1]);

// What each option should come to. Literal, so a wrong value in tokens/tokens.json fails here. The first is the default.
const SCALES: Record<string, Record<string, Record<string, string>>> = {
  shape: {
    soft: { '--radius': '22px', '--radius-capsule': '999px', '--radius-xl': '30px', '--radius-lg': '22px', '--radius-md': '14px', '--radius-sm': '10px', '--radius-xs': '6px', capsuleRadius: '999px', roundedRadius: '14px' },
    crisp: { '--radius': '12px', '--radius-capsule': '999px', '--radius-xl': '20px', '--radius-lg': '12px', '--radius-md': '4px', '--radius-sm': '2px', '--radius-xs': '2px', capsuleRadius: '999px', roundedRadius: '4px' },
    square: { '--radius': '4px', '--radius-capsule': '6px', '--radius-xl': '12px', '--radius-lg': '4px', '--radius-md': '2px', '--radius-sm': '2px', '--radius-xs': '2px', capsuleRadius: '6px', roundedRadius: '2px' },
  },
  density: {
    regular: { '--size-control-sm': '28px', '--size-control-md': '36px', '--size-control-lg': '50px', '--ld-table-control-w': '52px', capsuleHeight: '36px', roundedHeight: '50px', checkboxHit: '44px' },
    compact: { '--size-control-sm': '24px', '--size-control-md': '30px', '--size-control-lg': '40px', '--ld-table-control-w': '46px', capsuleHeight: '30px', roundedHeight: '40px', checkboxHit: '38px' },
    touch: { '--size-control-sm': '36px', '--size-control-md': '44px', '--size-control-lg': '56px', '--ld-table-control-w': '52px', capsuleHeight: '44px', roundedHeight: '56px', checkboxHit: '44px' },
  },
};
const defaults = Object.values(SCALES).map((options) => Object.values(options)[0]);

test('The installed theme carries every shape and density', () => {
  const blocks = Object.entries(SCALES).flatMap(([prop, options]) => Object.keys(options).map((option) => `[data-${prop}="${option}"]`));
  expect(blocks.filter((block) => !installedTheme().includes(block))).toEqual([]);
  // `rounded-capsule` is unused here, so no built CSS shows it. This is what makes it follow shape in a project.
  expect(installedTheme()).toMatch(/@theme inline reference \{\s*--radius-capsule: var\(--radius-capsule\);/);
});

test('A capsule survives a shadow root that loads the same CSS', async ({ page }) => {
  await page.goto('/components');
  const radius = await page.evaluate(async () => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(await (await fetch(document.querySelector<HTMLLinkElement>('link[rel=stylesheet]')!.href)).text());
    const root = document.body.appendChild(document.createElement('div')).attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [sheet];
    root.innerHTML = '<button class="ld-btn">Capsule</button>';
    return getComputedStyle(root.firstElementChild!).borderRadius;
  });
  expect(radius).toBe('999px');
});

// A capsule button shows --radius-capsule and the md height; a rounded large one shows the derived --radius-md and the lg
// height; a checkbox shows --ld-table-hit, which derives from the md height.
const controls = (name: string) => h('span', { 'data-case': name },
  h(Button, null, 'Capsule'), h(Button, { shape: 'rounded', size: 'lg' }, 'Rounded'), h(Checkbox, { 'aria-label': 'Hit target' }));
const portal = (children: ReactNode) => h('div', { 'data-portal': '' }, h(ThemeScope, null, children));

const PLACEMENTS: Array<[string, (parent: ThemeProviderProps, child: ThemeProviderProps, name: string) => ReactElement]> = [
  ['nested', (parent, child, name) => h(ThemeProvider, parent, h(ThemeProvider, child, controls(name)))],
  ['overlay', (parent, child, name) => h(ThemeProvider, parent, h(ThemeProvider, child, portal(controls(name))))],
  ['provider in an overlay', (parent, child, name) => h(ThemeProvider, parent, portal(h(ThemeProvider, child, controls(name))))],
];

// The real provider's markup under the real stylesheet. Each scope moves to <body>, where a portal puts it, so it has no
// wrapper to inherit from. Rendered on the server, because the site has no route that takes arbitrary providers.
async function mount(page: Page, ...trees: ReactElement[]) {
  await page.goto('/components');
  await page.evaluate((html) => {
    document.body.insertAdjacentHTML('beforeend', html);
    document.querySelectorAll('[data-portal]').forEach((scope) => document.body.append(...scope.children));
  }, renderToString(h(Fragment, null, ...trees)));
}

const measure = (page: Page): Promise<Record<string, Record<string, string>>> => page.locator('[data-case]').evaluateAll((els) => Object.fromEntries(els.map((el) => {
  const own = getComputedStyle(el);
  const [capsule, rounded, checkbox] = [...el.children].map((child) => getComputedStyle(child));
  // A derived variable reads as unresolved calc() text until something uses it, so padding resolves it to a length.
  const ruler = el.appendChild(document.createElement('i'));
  const derived = Object.fromEntries(['--radius-xl', '--radius-lg', '--radius-md', '--radius-sm', '--radius-xs', '--ld-table-control-w'].map((n) => {
    ruler.style.paddingLeft = `var(${n})`;
    return [n, getComputedStyle(ruler).paddingLeft];
  }));
  ruler.remove();
  return [(el as HTMLElement).dataset.case, {
    ...derived,
    ...Object.fromEntries(['--radius', '--radius-capsule', '--size-control-sm', '--size-control-md', '--size-control-lg'].map((n) => [n, own.getPropertyValue(n)])),
    capsuleRadius: capsule.borderRadius, roundedRadius: rounded.borderRadius, capsuleHeight: capsule.height, roundedHeight: rounded.height, checkboxHit: checkbox.height,
  }];
})));

test.describe('Nested providers', () => {
  for (const [prop, values] of Object.entries(SCALES)) {
    test(`Every ${prop} inherits when unset and wins when set, nested and in overlays`, async ({ page }) => {
      expect(optionsOf(prop).sort()).toEqual(Object.keys(values).sort());
      const options = [undefined, ...optionsOf(prop)];
      const cases = PLACEMENTS.flatMap(([placement, place]) => options.flatMap((parent) => options.map((child) => {
        const name = `${placement}: ${child ?? 'unset'} under ${parent ?? 'unset'}`;
        return { name, tree: place({ [prop]: parent }, { [prop]: child }, name), option: child ?? parent ?? Object.keys(values)[0] };
      })));
      await mount(page, ...cases.map(({ tree }) => tree));
      expect(await measure(page)).toEqual(Object.fromEntries(cases.map(({ name, option }) => [name, Object.assign({}, ...defaults, values[option])])));
    });
  }

  // `matchMedia` answers `os` for both queries. Nothing else in these trees reads `window`.
  function renderUnderOS(os: boolean, tree: ReactElement) {
    Object.assign(globalThis, { window: { matchMedia: () => ({ matches: os }) } });
    try {
      return renderToString(tree);
    } finally {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }

  const FOLLOWS_OS = {
    scheme: { fromOS: (os: boolean) => (os ? 'dark' : 'light'), inTheme: (theme: string) => theme.split('-')[0] },
    contrast: { fromOS: (os: boolean) => (os ? 'high' : 'standard'), inTheme: (theme: string) => (theme.endsWith('-hc') ? 'high' : 'standard') },
  };

  for (const [prop, { fromOS, inTheme }] of Object.entries(FOLLOWS_OS)) {
    test(`Every ${prop} inherits when unset and wins when set, and 'auto' follows the OS`, () => {
      expect(optionsOf(prop)).toEqual(expect.arrayContaining(['auto', 'inherit']));
      const children = [undefined, ...optionsOf(prop)];
      const parents = children.filter((option) => option !== 'inherit');
      const actual: Record<string, string> = {};
      const expected: Record<string, string> = {};
      for (const os of [false, true]) {
        const resolved = (option = 'auto') => (option === 'auto' ? fromOS(os) : option);
        for (const parent of parents) {
          for (const child of children) {
            const name = `${child ?? 'unset'} under ${parent ?? 'unset'}, OS ${fromOS(os)}`;
            const html = renderUnderOS(os, h(ThemeProvider, { [prop]: parent }, h(ThemeProvider, { [prop]: child })));
            const [root, nested] = [...html.matchAll(/data-theme="([^"]*)"/g)].map((match) => inTheme(match[1]));
            actual[`${name}: root`] = root;
            expected[`${name}: root`] = resolved(parent);
            actual[name] = nested;
            expected[name] = resolved(child === undefined || child === 'inherit' ? parent : child);
          }
        }
      }
      expect(actual).toEqual(expected);
    });
  }

  test('One that sets only an accent keeps its parent\'s scheme, contrast, shape and density, and so do its overlays', async ({ page }) => {
    const parent = { scheme: 'dark', contrast: 'high', accent: 'orange', shape: 'square', density: 'compact' } as const;
    await mount(page, ...PLACEMENTS.map(([placement, place]) => place(parent, { accent: 'teal' }, placement)));

    const measured = await measure(page);
    for (const [placement] of PLACEMENTS) expect(measured[placement], placement).toEqual({ ...SCALES.shape.square, ...SCALES.density.compact });

    const probes = PLACEMENTS.map(([placement]) => page.locator(`[data-case="${placement}"]`));
    const nested = await read(probes[0]);
    await expect(probes[0].locator('xpath=ancestor::*[@data-theme][1]')).toHaveAttribute('data-theme', 'dark-hc');
    expect(nested['color-scheme']).toBe('dark');
    expect(await asComputed(page, nested['--background'])).toBe(await asComputed(page, tokenValue('background', 'dark-hc')));
    expect(await asComputed(page, nested['--primary'])).toBe(await asComputed(page, tokenValue('preset-teal', 'dark-hc')));
    for (const probe of probes.slice(1)) expect(await read(probe)).toEqual(nested);
  });

  test('`tokens` beats a shape on the same provider, and the radius chain, nested providers and overlays follow', async ({ page }) => {
    const parent = { shape: 'square', tokens: { radius: '18px' } } as const;
    await mount(page,
      h(ThemeProvider, parent, controls('own')),
      h(ThemeProvider, parent, portal(controls('own overlay'))),
      ...PLACEMENTS.map(([placement, place]) => place(parent, {}, placement)),
      h(ThemeProvider, { shape: 'square' }, h(ThemeProvider, null, controls('under square'))),
    );
    const { 'under square': square, ...overridden } = await measure(page);
    expect(Object.keys(overridden)).toHaveLength(2 + PLACEMENTS.length);
    for (const [name, values] of Object.entries(overridden)) {
      expect(values, name).toMatchObject({ '--radius': '18px', '--radius-capsule': '6px', '--radius-xl': '26px', '--radius-sm': '6px', capsuleRadius: '6px', roundedRadius: '10px' });
    }
    expect(square).toMatchObject(SCALES.shape.square);
  });

  test('An explicit shape or density beats a class in either order and in a layer, unset lets it through, and `tokens` reaches overlays', async ({ page }) => {
    const explicit = { shape: 'square', density: 'compact', className: 'mine' } as const;
    await mount(page,
      h(ThemeProvider, explicit, controls('explicit'), portal(controls('explicit overlay'))),
      h(ThemeProvider, { className: 'mine' }, controls('unset'), portal(controls('unset overlay'))),
      h(ThemeProvider, { ...explicit, tokens: { radius: '18px', 'size-control-md': '35px' } }, controls('tokens'), portal(controls('tokens overlay'))),
    );
    const rule = '.mine { --radius: 8px; --size-control-md: 33px; }';
    const expected = {
      explicit: { '--radius': '4px', '--size-control-md': '30px', capsuleHeight: '30px' },
      'explicit overlay': { '--radius': '4px', '--size-control-md': '30px', capsuleHeight: '30px' },
      unset: { '--radius': '8px', '--size-control-md': '33px', capsuleHeight: '33px' },
      'unset overlay': { '--radius': '22px', '--size-control-md': '36px', capsuleHeight: '36px' },
      tokens: { '--radius': '18px', '--size-control-md': '35px', capsuleHeight: '35px' },
      'tokens overlay': { '--radius': '18px', '--size-control-md': '35px', capsuleHeight: '35px' },
    };
    for (const css of [rule, `@layer utilities { ${rule} }`]) {
      for (const end of ['prepend', 'append'] as const) {
        await page.evaluate(([text, at]) => {
          const style = document.getElementById('mine') ?? Object.assign(document.createElement('style'), { id: 'mine' });
          style.textContent = text;
          document.head[at as 'prepend' | 'append'](style);
        }, [css, end]);
        expect(await measure(page), `${end}: ${css}`).toMatchObject(expected);
      }
    }
  });

  test('A plain data-shape or data-density with no data-theme does nothing', async ({ page }) => {
    await mount(page, h('div', { 'data-shape': 'square', 'data-density': 'compact' }, controls('plain')));
    expect((await measure(page)).plain).toEqual(Object.assign({}, ...defaults));
  });

  test('At the root, unset leaves a project\'s own values alone and an explicit value replaces them', async ({ page }) => {
    await mount(page, h(ThemeProvider, null, controls('unset')), h(ThemeProvider, { shape: 'soft', density: 'regular' }, controls('explicit')));
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--radius', '9px');
      document.documentElement.style.setProperty('--size-control-md', '33px');
    });
    const { unset, explicit } = await measure(page);
    expect(unset).toMatchObject({ '--radius': '9px', '--size-control-md': '33px', roundedRadius: '2px', capsuleHeight: '33px' });
    expect(explicit).toMatchObject({ '--radius': '22px', '--size-control-md': '36px', roundedRadius: '14px', capsuleHeight: '36px' });
  });
});
