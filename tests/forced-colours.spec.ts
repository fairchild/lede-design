import { test, expect, type Locator, type Page } from '@playwright/test';

// Forced colours remove backgrounds and shadows, so a control drawn with them disappears, and axe doesn't test this mode.
// Controls are found by role, so any control on these routes is walked; one that appears only on another route isn't.
const ROUTES = [
  '/components', '/app/settings', '/app/settings/appearance', '/app/welcome', '/app/welcome/preferences', '/app/work', '/app/inbox/m1',
];
const ROLES = ['button', 'link', 'textbox', 'combobox', 'checkbox', 'radio', 'switch'] as const;

/** What each control paints. A hidden native input is drawn by what sits beside it, and by its fieldset if that's a track. */
function paint(controls: Element[]) {
  const channels = (colour: string) => colour.match(/[\d.]+/g)!.map(Number);
  const canvas = channels(getComputedStyle(document.body).backgroundColor).slice(0, 3).join();
  const shows = (colour: string) => {
    const [r, g, b, a = 1] = channels(colour);
    return a > 0 && [r, g, b].join() !== canvas;
  };
  const edged = (s: CSSStyleDeclaration) =>
    (s.borderTopStyle !== 'none' && parseFloat(s.borderTopWidth) > 0 && shows(s.borderTopColor)) ||
    (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && shows(s.outlineColor));
  return controls.map((el) => {
    const hidden = el.matches('input') && getComputedStyle(el).opacity === '0';
    const parts = hidden ? [...el.parentElement!.children, el.closest('fieldset')!].filter(Boolean) : [el];
    const styles = parts.map((part) => getComputedStyle(part));
    return {
      filled: styles.some((s) => shows(s.backgroundColor)),
      edged: styles.some(edged),
      text: (el as HTMLElement).innerText.trim() !== '',
      html: el.outerHTML.slice(0, 100),
    };
  });
}

/** A disabled control's opacity, multiplied down its ancestors, its colour, and GrayText where it sits. */
function greyed(controls: Element[]) {
  return controls.map((el) => {
    let opacity = 1;
    for (let node: Element | null = el; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    const probe = el.parentElement!.appendChild(document.createElement('i'));
    probe.style.color = 'GrayText';
    const grey = getComputedStyle(probe).color;
    probe.remove();
    return { html: el.outerHTML.slice(0, 100), opacity, colour: getComputedStyle(el).color, grey };
  });
}

const describe = (control: Locator) => control.evaluate((el) => el.outerHTML.slice(0, 100));
const look = (control: Locator) => control.screenshot();

async function open(page: Page, route: string, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme });
  // A later onboarding step opens only once Continue has reached it.
  if (route === '/app/welcome/preferences') {
    await page.goto('/app/welcome');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Make it yours' })).toBeVisible();
  } else await page.goto(route);
  await expect(page).toHaveURL(new RegExp(`${route}$`));
  await expect(page.locator('main')).toBeVisible();
  // A row's link is named by its ID in the table, and by its title and then its ID on a card.
  if (route === '/app/work') await expect(page.getByRole('link', { name: /\bWI-\d+/ }).first()).toBeVisible();
}

for (const scheme of ['light', 'dark'] as const) {
  for (const route of ROUTES) {
    test(`forced colours: ${route} · ${scheme}: every control keeps a boundary, a focus ring, and a state beyond font weight`, async ({ page }) => {
      test.slow(); // Pictures of a full page, for each kind of control.
      await open(page, route, scheme);
      const painted = async () => (await Promise.all(ROLES.map((role) => page.getByRole(role).evaluateAll(paint)))).flat();
      // A control with no shape of its own in normal colours is identified by its text, which forced colours keep
      // (WCAG 1.4.11). Anything drawn as a shape has to stay one.
      const normal = await painted();
      expect(normal.length).toBeGreaterThan(0);

      // One font weight, so bold can't tell two pictures apart. Reduced motion cuts each ease to 1ms, and the wait lets
      // the ones the switch starts finish, so a colour is read where it settles.
      await page.addStyleTag({ content: '* { font-weight: 400 !important; }' });
      await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
      expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
      await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
      const forced = await painted();
      expect(forced.length).toBe(normal.length);
      for (const [i, control] of forced.entries()) {
        const labelled = !normal[i].filled && !normal[i].edged && control.text;
        expect.soft(control.edged || control.filled || labelled, control.html).toBe(true);
      }
      // Disabled is GrayText at full strength: dimming it again would take it below what the user's palette set.
      for (const role of ROLES) {
        for (const control of await page.getByRole(role, { disabled: true }).evaluateAll(greyed)) {
          expect.soft(control, control.html).toMatchObject({ opacity: 1, colour: control.grey });
        }
      }

      // One of each kind takes the focus. The first Tab makes the page treat focus as keyboard focus, and a ring sits
      // outside its control's box, so the picture has a margin.
      await page.keyboard.press('Tab');
      for (const role of ROLES) {
        const controls = page.getByRole(role, { disabled: false });
        // An inert control, such as Appearance's preview, can't take focus, so it has no ring to draw.
        const kinds = await controls.evaluateAll((els) => els.map((el) => (el.closest('[inert]') ? null : el.className)));
        for (const i of new Set(kinds.flatMap((kind) => (kind === null ? [] : [kinds.indexOf(kind)])))) {
          const control = controls.nth(i);
          await control.evaluate((el: HTMLInputElement) => { el.readOnly = true; }); // A caret would be a difference too.
          await control.focus();
          await control.evaluate((el) => el.scrollIntoView({ block: 'center' }));
          const box = (await control.boundingBox())!;
          const clip = { x: box.x - 6, y: box.y - 6, width: box.width + 12, height: box.height + 12 };
          const focused = await page.screenshot({ clip });
          await control.blur();
          expect.soft(focused.equals(await page.screenshot({ clip })), await describe(control)).toBe(false);
        }
      }

      // The parent's picture, as a current row's mark is drawn on the row around its link.
      for (const current of await page.locator('[aria-current]').filter({ visible: true }).all()) {
        const on = await look(current.locator('..'));
        await current.evaluate((el) => el.setAttribute('aria-current', 'false'));
        expect.soft(on.equals(await look(current.locator('..'))), await describe(current)).toBe(false);
      }
      // One of each family: a radio group's name, or the role. They share their drawing.
      const families = new Set<string>();
      for (const role of ['switch', 'radio', 'checkbox'] as const) {
        for (const control of await page.getByRole(role, { disabled: false }).all()) {
          const family = (await control.getAttribute('name')) ?? role;
          const checked = await control.isChecked();
          if (families.has(family) || (role === 'radio' && checked)) continue;
          families.add(family);
          const before = await look(control);
          // A click from script: a mouse would add hover, and focus would add a ring, to the second picture only.
          await control.evaluate((el: HTMLElement) => el.click());
          await expect(control).toBeChecked({ checked: !checked });
          expect.soft(before.equals(await look(control)), await describe(control)).toBe(false);
        }
      }
    });
  }
}

for (const scheme of ['light', 'dark'] as const) {
  test(`forced colours · ${scheme}: a disabled menu item the keyboard reaches is outlined, not filled`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'Row menus open from the table layout here.');
    await page.emulateMedia({ colorScheme: scheme, forcedColors: 'active' });
    await page.goto('/blocks/data-table');
    const table = page.getByRole('table', { name: 'Work items (client mode)' });
    for (const trigger of await table.getByRole('button', { name: /^More actions for / }).all()) {
      await trigger.focus();
      await page.keyboard.press('Enter');
      const menu = page.getByRole('menu');
      const locked = menu.getByRole('menuitem', { disabled: true });
      if (await locked.count()) {
        await expect(menu.getByRole('menuitem').first()).toBeFocused();
        await page.keyboard.press('ArrowDown'); // Assign to me, Archive (the disabled one), Delete
        await expect(locked).toHaveAttribute('data-highlighted');
        // GrayText on a Highlight fill fell to 1.24:1. Against Canvas it is whatever the user's palette set.
        const [item, reason] = await Promise.all([locked, locked.getByText(/Locked/)].map((part) => part.evaluate((el) => {
          const system = (keyword: string) => {
            const probe = el.appendChild(document.createElement('i'));
            probe.style.color = keyword;
            const colour = getComputedStyle(probe).color;
            probe.remove();
            return colour;
          };
          const s = getComputedStyle(el);
          return { background: s.backgroundColor, colour: s.color, outline: s.outlineStyle, canvas: system('Canvas'), grey: system('GrayText') };
        })));
        expect(item.background).toBe(item.canvas);
        expect(item.colour).toBe(item.grey);
        expect(item.outline).toBe('solid');
        expect(reason.colour).toBe(reason.grey);
        return;
      }
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
    }
    throw new Error('expected a locked row in the client example');
  });
}

// Forced colours leave an SVG's fill alone, so the mark keeps its brand colours unless its rule hands it system ones.
for (const scheme of ['light', 'dark'] as const) {
  test(`forced colours: the docs mark · ${scheme}: its tile is CanvasText and its lines are Canvas`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'The sidebar, and the mark in it, show on wide screens only.');
    await page.emulateMedia({ colorScheme: scheme, forcedColors: 'active' });
    await page.goto('/');
    const mark = page.locator('.docs-mark');
    await expect(mark).toBeVisible();
    const fills = await mark.evaluate((svg) => {
      const system = (keyword: string) => {
        const probe = svg.parentElement!.appendChild(document.createElement('i'));
        probe.style.color = keyword;
        const colour = getComputedStyle(probe).color;
        probe.remove();
        return colour;
      };
      return {
        tile: getComputedStyle(svg.querySelector('.docs-mark-tile')!).fill,
        lines: [...svg.querySelectorAll('.docs-mark-line')].map((line) => getComputedStyle(line).fill),
        canvasText: system('CanvasText'),
        canvas: system('Canvas'),
      };
    });
    expect(fills.canvasText).not.toBe(fills.canvas);
    expect(fills.tile).toBe(fills.canvasText);
    expect(fills.lines).toEqual([fills.canvas, fills.canvas, fills.canvas]);
  });
}

// Forced colours drop box-shadow, so each edge a Lede component draws with one has a twin there: a border, an outline or a
// fill that differs from what's behind it, on the element or on the one named here that draws its state. Each theme
// draws a different set of edges.
const STAND_INS: Record<string, string> = { 'ld-seg-thumb': '.ld-seg-input:checked + .ld-seg-label' };
const EDGE_THEMES = [
  { name: 'light', scheme: 'light', hc: false }, { name: 'dark', scheme: 'dark', hc: false },
  { name: 'light-hc', scheme: 'light', hc: true }, { name: 'dark-hc', scheme: 'dark', hc: true },
] as const;
for (const theme of EDGE_THEMES) {
  for (const [route, width] of [['/components', 1280], ['/app/settings', 1280], ['/app/settings/appearance', 390], ['/blocks/data-table', 390]] as const) {
    test(`forced colours: ${route} · ${theme.name} at ${width}px: an edge drawn with box-shadow keeps a twin`, async ({ page, isMobile }) => {
      test.skip(isMobile, 'The widths are set here, so one project is enough.');
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme.scheme });
      await page.addInitScript((hc) => localStorage.setItem('lede:appearance', JSON.stringify({ highContrast: hc })), theme.hc);
      await page.goto(route);
      await expect(page.locator('main').first()).toBeVisible();
      // A 1px spread with no offset or blur is an edge; a soft shadow only lifts.
      const edges = await page.evaluate(() => {
        const found = [...document.querySelectorAll('*')].filter((el) =>
          [...el.classList].some((name) => name.startsWith('ld-')) && el.checkVisibility() && /0px 0px 0px 1px/.test(getComputedStyle(el).boxShadow));
        (window as unknown as { edges: Element[] }).edges = found;
        return found.length;
      });
      expect(edges).toBeGreaterThan(0);
      await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
      await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
      const missing = await page.evaluate((standIns) => {
        // Forced colours keep a fill's alpha and make its colour Canvas, so a fill is compared by colour alone.
        const channels = (colour: string) => colour.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
        const rgb = (colour: string) => channels(colour).slice(0, 3).join();
        const clear = (colour: string) => (channels(colour)[3] ?? 1) === 0;
        const behind = (el: Element) => {
          for (let node = el.parentElement; node; node = node.parentElement) if (!clear(getComputedStyle(node).backgroundColor)) return getComputedStyle(node).backgroundColor;
          return getComputedStyle(document.documentElement).backgroundColor;
        };
        const shows = (el: Element) => {
          const s = getComputedStyle(el);
          return (s.borderTopStyle !== 'none' && parseFloat(s.borderTopWidth) > 0) || (s.borderInlineStartStyle !== 'none' && parseFloat(s.borderInlineStartWidth) > 0) ||
            (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (!clear(s.backgroundColor) && rgb(s.backgroundColor) !== rgb(behind(el)));
        };
        return (window as unknown as { edges: Element[] }).edges.flatMap((el) => {
          const standIn = Object.entries(standIns).find(([name]) => el.classList.contains(name));
          const drawn = standIn ? el.parentElement!.querySelector(standIn[1]) : el;
          return drawn && shows(drawn) ? [] : [el.outerHTML.slice(0, 120)];
        });
      }, STAND_INS);
      expect(missing).toEqual([]);
    });
  }
}
