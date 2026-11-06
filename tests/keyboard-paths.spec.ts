// Keys that act: Enter moves onboarding on, Escape backs out of each nested screen one layer per press, and a field that
// has changed keeps its Escape. Each nested screen's Escape is the `escape` column of ARRIVALS in `tests/focus-table.ts`.
import { test, expect, type Page } from '@playwright/test';
import { ARRIVALS, button, driver, each, expectLanding, field, h1, h2, link, locate, rowTests, type Arrival, type Device } from './focus-table';
import { focusSettled, focusTrail, trackFocus } from './focus-trail';

test.beforeEach(({ page }) => trackFocus(page));

/** Reaches a row's screen the way its `via` does, or by a cold load without one. */
async function reach(page: Page, row: Arrival, device: Device) {
  await row.setup?.(page);
  if (row.via) {
    await page.goto(row.via.from);
    await locate(page, row.via.link).first().waitFor();
    await driver(page, device).press(row.via.link);
    await expect.poll(() => new URL(page.url()).pathname).not.toBe(new URL(row.via.from, page.url()).pathname);
  } else {
    await page.goto(row.route);
  }
  // The URL changes before a slow screen renders, and until then the screen being left still holds the keys.
  await locate(page, each(row.arrival, device)).first().waitFor();
  await focusTrail(page);
}

for (const row of ARRIVALS) {
  const { escape, enter } = row;
  if (escape) {
    rowTests(`${row.route} · Escape backs out`, ['escape'], { escape: escape.pending }, undefined, async (page, device) => {
      await reach(page, row, device);
      await page.keyboard.press('Escape');
      await expect(page).toHaveURL(escape.url);
      await expectLanding(page, each(escape.target, device), 'Escape');
    });
  }
  if (enter) {
    rowTests(`${row.route} · Enter at arrival`, ['enter'], { enter: enter.pending }, enter.only, async (page, device) => {
      await row.setup?.(page);
      await page.goto(row.route);
      await focusTrail(page);
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(enter.url);
      await expectLanding(page, each(enter.target, device), 'Enter');
    });
  }
}

rowTests('Enter, Enter: Replay onboarding to Today on Enter alone, with the answers saved', ['path'], {}, undefined, async (page) => {
  await page.goto('/app/settings');
  await locate(page, link('Replay onboarding')).focus();
  await page.keyboard.press('Enter');
  for (const [url, landing] of [
    [/\/app\/welcome$/, field('Name')],
    [/\/preferences$/, { role: 'radio', name: 'Blue' }],
    [/\/review$/, button('Finish')],
    [/\/done$/, link('Get started')],
  ] as const) {
    await expect(page).toHaveURL(url);
    await expectLanding(page, landing, `Enter to ${url}`);
    await page.keyboard.press('Enter');
  }
  await expect(page).toHaveURL(/\/app$/);
  await expectLanding(page, h1('Today'), 'Get started');
  const onboarding = await page.evaluate(() => JSON.parse(sessionStorage.getItem('lede:demo') ?? '{}').onboarding);
  expect(onboarding).toEqual({ finished: true });
});

// Onboarding's own rules beside the table's rows: what Escape drops, what a Review row opens, and when a target gives way.
const draft = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('lede:demo') ?? '{}').onboarding?.draft);

test('Escape on an unchanged step is Cancel: it drops the draft the earlier steps made', async ({ page }) => {
  await page.goto('/app/settings');
  await driver(page, 'desktop').press(link('Replay onboarding'));
  await page.getByLabel('Name').fill('Ada Lovelace');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(locate(page, h1('Make it yours'))).toBeVisible();
  await expect.poll(() => draft(page)).toMatchObject({ answers: { name: 'Ada Lovelace' } });
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expectLanding(page, link('Replay onboarding'), 'Escape');
  expect(await draft(page)).toBeUndefined();
  await expect(page.getByRole('main').getByRole('link', { name: /^Hana Sato/ })).toBeVisible();
});

// A changed answer keeps Escape after focus leaves its field: the field's own rule ends there, and the step's takes over.
for (const [step, change] of [
  ['Account', async (page: Page) => {
    await page.getByLabel('Name').focus();
    await page.keyboard.press('End');
    await page.keyboard.type(' Jr.');
    await page.keyboard.press('Tab');
  }],
  ['Preferences', async (page: Page) => {
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('radio', { name: 'Orange' }).check();
  }],
] as const) {
  test(`a changed step keeps Escape: ${step} stays, with the answer, wherever focus is`, async ({ page }) => {
    await page.goto('/app/welcome');
    await change(page);
    const url = page.url();
    await page.keyboard.press('Escape');
    await focusSettled(page, 300);
    expect(page.url()).toBe(url);
    if (step === 'Account') {
      await expect(page.getByLabel('Email')).toBeFocused();
      await expect(page.getByLabel('Name')).toHaveValue('Hana Sato Jr.');
    } else await expect(page.getByRole('radio', { name: 'Orange' })).toBeChecked();
    // Changed back, the step is as it opened, and Escape cancels again.
    if (step === 'Account') { await page.getByLabel('Name').fill('Hana Sato'); await page.keyboard.press('Tab'); }
    else await page.getByRole('radio', { name: 'Blue' }).check();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/app$/);
  });
}

test('Enter on the brief switch continues, as it would from a checkbox, and leaves the switch as it was', async ({ page }) => {
  await page.goto('/app/welcome');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(locate(page, h1('Make it yours'))).toBeVisible();
  const brief = page.getByRole('switch', { name: 'Send me a daily brief' });
  await brief.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/app\/welcome\/review$/);
  await expectLanding(page, button('Finish'), 'Enter on the switch');
  await expect(page.getByRole('button', { name: /^Daily brief/ })).toContainText('On, morning');
});

test('Enter on a switch outside a form toggles it, as Base UI’s switch does: Settings has no form to submit', async ({ page }) => {
  await page.goto('/app/settings');
  const brief = page.getByRole('switch', { name: 'Daily brief' });
  await brief.focus();
  const errors: Error[] = [];
  page.on('pageerror', (e) => errors.push(e));
  await expect(brief).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Enter');
  await expect(brief).toHaveAttribute('aria-checked', 'false');
  await expect(brief).toBeFocused();
  expect(errors).toEqual([]);
});

// A Review row is the person asking to change one answer, so its step opens on that control, on touch too.
for (const [row, url, target] of [
  ['Name', /\/app\/welcome$/, field('Name')],
  ['Accent', /\/preferences$/, { role: 'radio', name: 'Blue' }],
  ['Daily brief', /\/preferences$/, { role: 'switch', name: 'Send me a daily brief' }],
] as const) {
  rowTests(`A Review row opens what it names: ${row}`, ['target'], {}, undefined, async (page, device) => {
    await page.goto('/app/welcome');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(locate(page, h1('Make it yours'))).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/review$/);
    await focusTrail(page);
    await driver(page, device).press(button(new RegExp(`^${row}`)));
    await expect(page).toHaveURL(url);
    await expectLanding(page, target, `The ${row} row`);
  });
}

test('Finish below the first viewport gives way to the h1, so arrival never scrolls from the title', async ({ page }) => {
  await page.goto('/app/welcome');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(locate(page, h1('Make it yours'))).toBeVisible();
  await page.setViewportSize({ width: 390, height: 360 });
  await locate(page, button('Continue')).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/review$/);
  await expectLanding(page, h1('Review'), 'Continue to Review');
});

// A pen raises the on-screen keyboard as a finger does, so a screen reached by pen lands on its h1 too.
test('Replay onboarding by pen starts Account at its h1', async ({ page }) => {
  await page.goto('/app/settings');
  const replay = page.getByRole('link', { name: 'Replay onboarding' });
  await replay.evaluate((el: HTMLElement) => {
    el.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'pen', bubbles: true }));
    el.click();
  });
  await expect(page).toHaveURL(/\/app\/welcome$/);
  await expectLanding(page, h1('Create your account'), 'Replay by pen');
});

test('Account puts the cursor in its first field that needs input, and labels the on-screen Enter key next', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A cold load on a phone lands on the h1; the arrival table checks it.');
  await page.goto('/app/welcome');
  await expect(page.getByLabel('Name')).toBeFocused();
  for (const label of ['Name', 'Email']) await expect(page.getByLabel(label)).toHaveAttribute('enterkeyhint', 'next');
  await page.getByLabel('Email').fill('ada@');
  await page.reload();
  await expect(page.getByLabel('Email')).toBeFocused();
  await page.getByLabel('Name').fill('');
  await page.reload();
  await expect(page.getByLabel('Name')).toBeFocused();
});

// Rule 1.1: a step never pulls focus out of a parent page that embeds it.
for (const [step, setup] of [['', 0], ['preferences', 1], ['review', 2]] as const) {
  test(`loading onboarding${step ? `’s ${step} step` : ''} leaves focus with a parent that embeds it`, async ({ page }) => {
    await page.goto('/app/welcome');
    for (let n = 0; n < setup; n++) {
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByRole('heading', { level: 1, name: n === 0 ? 'Make it yours' : 'Review' })).toBeVisible();
    }
    await page.evaluate((src) => {
      document.body.innerHTML = '<input id="mine"><iframe id="flow" style="width: 900px; height: 700px"></iframe>';
      document.getElementById('mine')!.focus();
      (document.getElementById('flow') as HTMLIFrameElement).src = src;
    }, `/app/welcome${step ? `/${step}` : ''}`);
    await expect(page.frameLocator('#flow').getByRole('heading', { level: 1 })).toBeVisible();
    await focusSettled(page, 300);
    await expect(page.locator('#mine')).toBeFocused();
  });
}

test('each onboarding step names itself in the tab title', async ({ page }) => {
  await page.goto('/app/welcome');
  for (const [title, next] of [['Create your account', 'Continue'], ['Make it yours', 'Continue'], ['Review', 'Finish'], ['You’re all set', '']] as const) {
    await expect(page).toHaveTitle(`${title} · Lede`);
    if (next) await page.getByRole('button', { name: next }).click();
  }
});

rowTests('Escape takes one layer per press: a row menu closes first, and the next Escape closes the message', ['layers'], {}, 'desktop', async (page) => {
  await page.goto('/app/inbox');
  const d = driver(page, 'desktop');
  await d.press(link(/Launch date: Tuesday or Thursday/));
  await expect(page).toHaveURL(/\/m2$/);
  await expectLanding(page, h2('Launch date: Tuesday or Thursday?'), 'Open');
  const more = button('More actions for Launch date: Tuesday or Thursday?');
  await d.press(more);
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  // Read once focus has settled: a retrying check would pass before a navigation the first Escape set off arrives.
  await focusSettled(page, 300);
  expect(new URL(page.url()).pathname, 'the first Escape only closes the menu').toBe('/app/inbox/m2');
  await expectLanding(page, more, 'First Escape');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/app\/inbox$/);
  await expectLanding(page, link(/Launch date: Tuesday or Thursday/), 'Second Escape');
});

for (const [where, open] of [
  ['Edit profile', async (page: Page) => { await page.goto('/app/profile'); await page.getByRole('button', { name: 'Edit profile' }).click(); }],
  ['onboarding’s Account step', async (page: Page) => { await page.goto('/app/welcome'); }],
] as const) {
  test(`a changed field keeps Escape: ${where} stays, with the typing`, async ({ page }) => {
    await open(page);
    const name = page.getByRole('textbox', { name: 'Name', exact: true });
    await name.focus();
    await page.keyboard.press('End');
    await page.keyboard.type(' Jr.');
    const url = page.url();
    await page.keyboard.press('Escape');
    await focusTrail(page);
    expect(page.url()).toBe(url);
    await expect(name).toBeFocused();
    await expect(name).toHaveValue('Hana Sato Jr.');
  });
}

// PageHeader's Escape leaves the key to whatever holds it first. Decisions is a nested page with a back link and
// nothing else that takes keys, so each probe adds the layer it tests to the page.
test.describe('Escape waits for the layer that holds it', () => {
  test.skip(({ isMobile }) => isMobile, 'Keys: the desktop project is enough.');
  const open = async (page: Page) => {
    await page.goto('/decisions');
    await expectLanding(page, h1('Decisions'), 'Cold load');
  };
  const stays = async (page: Page, how: string) => {
    await page.keyboard.press('Escape');
    await focusTrail(page);
    expect(new URL(page.url()).pathname, how).toBe('/decisions');
  };

  test('an open modal dialog closes first, and the next Escape takes the back link', async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const dialog = document.createElement('dialog');
      dialog.innerHTML = '<button>Close</button>';
      document.querySelector('main')!.append(dialog);
      dialog.showModal();
    });
    await stays(page, 'Escape closes the dialog and stays');
    await expect(page.locator('dialog')).not.toHaveAttribute('open');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/:\d+\/$/);
  });

  test('a field the person changed keeps Escape, and once it’s back as it was, Escape takes the back link', async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.setAttribute('aria-label', 'Probe');
      document.querySelector('main')!.append(input);
    });
    const probe = page.getByRole('textbox', { name: 'Probe' });
    await probe.focus();
    await page.keyboard.type('x');
    await stays(page, 'Escape in a changed field stays');
    await expect(probe).toBeFocused();
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/:\d+\/$/);
  });

  test('an IME composition keeps Escape', async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, cancelable: true }));
    });
    await focusTrail(page);
    expect(new URL(page.url()).pathname).toBe('/decisions');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/:\d+\/$/);
  });

  // A held Escape repeats its keydown with `repeat` set. The first press takes one layer and the repeats take none.
  const repeat = (page: Page) => page.evaluate(() => {
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', repeat: true, bubbles: true, cancelable: true }));
  });

  test('a held Escape backs out of one layer: its repeats leave the back link alone', async ({ page }) => {
    await open(page);
    await repeat(page);
    await focusTrail(page);
    expect(new URL(page.url()).pathname).toBe('/decisions');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/:\d+\/$/);
  });

  test('a held Escape closes a row menu and stops: its repeats leave the message open', async ({ page }) => {
    await page.goto('/app/inbox');
    const d = driver(page, 'desktop');
    await d.press(link(/Launch date: Tuesday or Thursday/));
    await expectLanding(page, h2('Launch date: Tuesday or Thursday?'), 'Open');
    const more = button('More actions for Launch date: Tuesday or Thursday?');
    await d.press(more);
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expectLanding(page, more, 'First Escape');
    await repeat(page);
    await focusSettled(page, 300);
    expect(new URL(page.url()).pathname, 'a repeat backs out of nothing more').toBe('/app/inbox/m2');
  });

  test('a held Escape’s repeats leave the selection bar open', async ({ page }) => {
    await page.goto('/blocks/data-table#dt-client');
    const box = page.getByRole('region', { name: 'Client mode' }).locator('tbody').getByRole('checkbox').first();
    await box.focus();
    await page.keyboard.press('Space');
    await page.getByRole('toolbar').first().getByRole('button').first().focus();
    await repeat(page);
    await focusSettled(page, 300);
    await expect(page.getByRole('toolbar')).toHaveCount(1);
    expect(new URL(page.url()).pathname).toBe('/blocks/data-table');
  });

  test('a held Escape’s repeats leave Edit profile open', async ({ page }) => {
    await page.goto('/app/profile');
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeFocused();
    await repeat(page);
    await focusSettled(page, 300);
    await expect(page.getByRole('form', { name: 'Edit profile' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/app/profile');
  });

  test('a search field with text clears first, and the next Escape takes the back link', async ({ page }) => {
    await page.goto('/blocks/data-table#dt-search');
    const search = page.getByRole('region', { name: 'Search and filters' }).getByRole('searchbox', { name: 'Search titles' });
    await search.focus();
    await page.keyboard.type('renew');
    await page.keyboard.press('Escape');
    await focusTrail(page);
    expect(new URL(page.url()).pathname).toBe('/blocks/data-table');
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/blocks$/);
  });

  test('Escape in a selection bar under a back link is Done, and the back link waits', async ({ page }) => {
    await page.goto('/blocks/data-table#dt-client');
    const region = page.getByRole('region', { name: 'Client mode' });
    const box = region.locator('tbody').getByRole('checkbox').first();
    await box.focus();
    await page.keyboard.press('Space');
    await page.getByRole('toolbar').first().getByRole('button').first().focus();
    await page.keyboard.press('Escape');
    await focusSettled(page, 300);
    expect(new URL(page.url()).pathname).toBe('/blocks/data-table');
    await expect(page.getByRole('toolbar')).toHaveCount(0);
    await expect(box).toBeFocused();
  });

  test('a search field that held text when it took focus keeps Escape', async ({ page }) => {
    await page.goto('/blocks/data-table#dt-search');
    const search = page.getByRole('region', { name: 'Search and filters' }).getByRole('searchbox', { name: 'Search titles' });
    await search.fill('renew');
    await page.getByRole('heading', { level: 1 }).focus();
    await search.focus();
    await page.keyboard.press('Escape');
    await focusSettled(page, 300);
    expect(new URL(page.url()).pathname).toBe('/blocks/data-table');
    await expect(search).toBeFocused();
  });

  test('while Edit profile is open, Escape outside the form leaves the back link alone', async ({ page }) => {
    await page.goto('/app/profile');
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await page.getByRole('main').getByRole('link', { name: 'Settings', exact: true }).focus();
    await page.keyboard.press('Escape');
    await focusSettled(page, 300);
    expect(new URL(page.url()).pathname).toBe('/app/profile');
    await expect(page.getByRole('form', { name: 'Edit profile' })).toBeVisible();
  });

  test('a changed draft keeps Edit profile open when Escape comes from a button', async ({ page }) => {
    await page.goto('/app/profile');
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await page.getByRole('textbox', { name: 'Role', exact: true }).fill('Lead');
    await page.getByRole('button', { name: 'Save changes' }).focus();
    await page.keyboard.press('Escape');
    await focusTrail(page);
    expect(new URL(page.url()).pathname).toBe('/app/profile');
    await expect(page.getByRole('textbox', { name: 'Role', exact: true })).toHaveValue('Lead');
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeFocused();
  });
});
