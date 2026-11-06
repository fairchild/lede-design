import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const NAME = 'Hana Sato';
const MODES = [
  { name: 'light', scheme: 'light' as const, hc: false },
  { name: 'dark', scheme: 'dark' as const, hc: false },
  { name: 'light-hc', scheme: 'light' as const, hc: true },
  { name: 'dark-hc', scheme: 'dark' as const, hc: true },
];

const heading = (page: Page, name: string | RegExp) => page.getByRole('heading', { level: 1, name });
const editButton = (page: Page) => page.getByRole('button', { name: 'Edit profile' });
const saveButton = (page: Page) => page.getByRole('button', { name: 'Save changes' });
const editForm = (page: Page) => page.getByRole('form', { name: 'Edit profile' });

async function openEditor(page: Page) {
  await page.goto('/app/profile');
  await editButton(page).click();
  await expect(editForm(page)).toBeVisible();
}

async function expectNoViolations(page: Page, state: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((v) => `${state} · ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test('The top of Settings leads to the profile, and the profile leads back', async ({ page }) => {
  await page.goto('/app/settings');
  const row = page.getByRole('main').getByRole('link').first();
  await expect(row).toHaveAccessibleName(new RegExp(NAME));
  await row.click();
  await expect(page).toHaveURL(/\/app\/profile$/);
  await expect(page).toHaveTitle('Profile · Lede');
  await expect(heading(page, NAME)).toBeFocused();
  await expect(page.getByRole('navigation', { name: 'App' }).getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('main').getByRole('link', { name: 'Settings' }).click();
  await expect(heading(page, 'Settings')).toBeVisible();
});

test('Wide screens also reach the profile from a person link above the way back to the docs', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The sidebar is a wide-screen layout.');
  await page.goto('/app');
  const nav = page.getByRole('navigation', { name: 'App' });
  const person = nav.getByRole('link', { name: `${NAME} (your profile)` });
  const docs = nav.getByRole('link', { name: 'Back to Lede docs' });
  expect((await person.boundingBox())!.y).toBeLessThan((await docs.boundingBox())!.y);
  await person.click();
  await expect(heading(page, NAME)).toBeFocused();
  await expect(nav.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  await expect(person).not.toHaveAttribute('aria-current');
});

test('The profile leads with who this is, then the details', async ({ page }) => {
  await page.goto('/app/profile');
  const main = page.getByRole('main');
  await expect(heading(page, NAME)).toBeVisible();
  await expect(main.locator('.ld-page-summary')).toHaveText('Product lead');
  await expect(main.getByText('HS', { exact: true })).toBeVisible();
  await expect(main.getByRole('img')).toHaveCount(0); // the h1 beside it already says who this is
  const details = page.getByRole('region', { name: 'Details' });
  for (const text of ['Email', 'hana@example.com', 'Location', 'Lisbon', 'Short bio']) await expect(details.getByText(text, { exact: true })).toBeVisible();
});

test('Editing happens on the page: focus moves in, a save is announced, and focus comes back', async ({ page, isMobile }) => {
  await page.goto('/app/profile');
  const status = page.getByRole('status');
  await expect(status).toBeAttached();
  await expect(status).toBeEmpty();

  await editButton(page).click();
  await expect(page).toHaveURL(/\/app\/profile$/);
  await expect(page.getByLabel('Name')).toBeFocused();
  await expect(page.getByLabel('Name')).toHaveValue(NAME);
  await expect(editButton(page)).toHaveCount(0);

  await page.getByLabel('Name').fill('  Hana Mori  ');
  await page.getByLabel('Location').fill('Porto');
  await expect(heading(page, NAME)).toBeVisible();
  // A focus change can cut off an announcement, so the status changes after focus has landed.
  await page.evaluate(() => {
    document.addEventListener('focusin', (e) => {
      if ((e.target as HTMLElement).textContent === 'Edit profile') document.body.dataset.statusAtFocus = document.querySelector('[role="status"]')!.textContent!;
    });
  });
  await saveButton(page).click();

  await expect(status).toHaveText('Profile saved');
  await expect(page.locator('body')).toHaveAttribute('data-status-at-focus', '');
  await expect(heading(page, 'Hana Mori')).toBeVisible();
  await expect(editForm(page)).toHaveCount(0);
  await expect(editButton(page)).toBeFocused();
  await expect(page.getByRole('region', { name: 'Details' }).getByText('Porto', { exact: true })).toBeVisible();

  await page.getByRole('main').getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('main').getByRole('link').first()).toHaveAccessibleName(/Hana Mori/);
  if (!isMobile) await expect(page.getByRole('navigation', { name: 'App' }).getByRole('link', { name: 'Hana Mori (your profile)' })).toBeVisible();

  await page.goto('/app/profile');
  await expect(heading(page, 'Hana Mori')).toBeVisible();
});

test('Enter saves from a single-line field, and starts a new line in the bio', async ({ page }) => {
  await openEditor(page);
  await page.getByLabel('Short bio').focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(editForm(page)).toBeVisible();
  await page.getByLabel('Role').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Profile saved');
});

test('Validation stays inline, says how to fix it, and keeps what was typed', async ({ page }) => {
  await openEditor(page);
  const name = page.getByLabel('Name');
  const email = page.getByLabel('Email');
  await name.fill('   ');
  await email.fill('hana@');
  await page.getByLabel('Role').fill('Studio lead');
  await saveButton(page).click();

  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toHaveAccessibleDescription('Enter your name.');
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAccessibleDescription('Enter a complete email address, like name@example.com.');
  await expect(page.getByRole('status')).toBeEmpty();
  await expect(email).toHaveValue('hana@');
  await expect(page.getByLabel('Role')).toHaveValue('Studio lead');
  await expect(heading(page, NAME)).toBeVisible();

  await name.fill(NAME);
  await saveButton(page).click();
  await expect(email).toBeFocused();
  await expect(name).not.toHaveAttribute('aria-invalid', 'true');

  await email.fill('hana@example.org');
  await page.getByLabel('Short bio').fill('x'.repeat(161));
  await saveButton(page).click();
  await expect(page.getByLabel('Short bio')).toBeFocused();
  await expect(page.getByLabel('Short bio')).toHaveAccessibleDescription('Shorten your bio to 160 characters. It’s 161 now.');

  await page.getByLabel('Short bio').fill('x'.repeat(160));
  await saveButton(page).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved');
  await expect(page.getByRole('region', { name: 'Details' }).getByText('hana@example.org', { exact: true })).toBeVisible();
});

test('Cancel drops the edits, says nothing was saved, and returns focus', async ({ page }) => {
  await openEditor(page);
  await page.getByLabel('Role').fill('Someone else');
  await saveButton(page).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved');

  await editButton(page).click();
  await expect(page.getByRole('status')).toBeEmpty();
  await page.getByLabel('Name').fill('Not saved');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(editForm(page)).toHaveCount(0);
  await expect(heading(page, NAME)).toBeVisible();
  await expect(editButton(page)).toBeFocused();
  await expect(page.getByRole('status')).toBeEmpty();

  await editButton(page).click();
  await expect(page.getByLabel('Name')).toHaveValue(NAME);
});

test('A failed save keeps the edits and an error that assistive tech hears, and saving can be tried again', async ({ page, context }) => {
  await openEditor(page);
  await page.getByLabel('Name').fill('Hana Mori');
  await page.getByLabel('Short bio').fill('A long edit nobody wants to type twice.');
  await context.setOffline(true);
  await saveButton(page).click();

  await expect(page.getByRole('alert')).toHaveText('You’re offline. Your edits are still here, so save again once you’re back online.');
  await expect(saveButton(page)).toBeFocused();
  await expect(page.getByLabel('Name')).toHaveValue('Hana Mori');
  await expect(page.getByLabel('Short bio')).toHaveValue('A long edit nobody wants to type twice.');
  await expect(page.getByRole('status')).toBeEmpty();
  await expect(heading(page, NAME)).toBeVisible();

  await context.setOffline(false);
  await saveButton(page).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(heading(page, 'Hana Mori')).toBeVisible();
});

test('The line under the name says what is left to add, and leaves once nothing is', async ({ page }) => {
  await openEditor(page);
  await page.getByLabel('Location').fill('');
  await page.getByLabel('Short bio').fill('  ');
  await saveButton(page).click();
  const summary = page.getByRole('main').locator('.ld-page-summary');
  await expect(summary).toHaveText('Product leadAdd a location and a short bio to complete your profile');
  await expect(page.getByRole('region', { name: 'Details' }).getByText('Not added')).toHaveCount(2);

  await editButton(page).click();
  await page.getByLabel('Location').fill('Porto');
  await page.getByLabel('Short bio').fill('Looks after the weekly review.');
  await saveButton(page).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved');
  await expect(summary).toHaveText('Product lead');
});

test('With the role, location and bio all missing, the line lists them with no serial comma', async ({ page }) => {
  await openEditor(page);
  await page.getByLabel('Role').fill('');
  await page.getByLabel('Location').fill('');
  await page.getByLabel('Short bio').fill('');
  await saveButton(page).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved');
  await expect(page.getByRole('main').locator('.ld-page-summary')).toHaveText('Add a role, a location and a short bio to complete your profile');
});

test('Long details wrap at 320px, and nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openEditor(page);
  const values = {
    Name: 'Alex Averylongfamilynamethatkeepsonandonandon',
    Role: 'Director of international supplier partnerships',
    Email: 'a.very.long.address.that.keeps.on.going@subdomain.example.com',
    Location: 'Averyveryverylongplacenamewithnospacesinitatallanywhereinit',
    'Short bio': 'Looks after the quarterly plan, the weekly review and every supplier contract that needs a second pair of eyes before it goes out.',
  };
  for (const [label, value] of Object.entries(values)) await page.getByLabel(label).fill(value);
  await saveButton(page).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  const box = (await page.getByRole('region', { name: 'Details' }).boundingBox())!;
  for (const value of [values.Email, values.Location, values['Short bio']]) {
    const text = page.getByText(value, { exact: true });
    await expect(text).toBeVisible();
    const clipped = await text.evaluate((e) => e.scrollWidth > e.clientWidth);
    expect(clipped).toBe(false);
    const t = (await text.boundingBox())!;
    expect(t.x + t.width).toBeLessThanOrEqual(box.x + box.width);
  }

  await page.getByRole('main').getByRole('link', { name: 'Settings' }).click();
  const row = page.getByRole('main').getByRole('link').first();
  const title = row.getByText(values.Name);
  const chevron = (await row.locator('xpath=following-sibling::*[name()="svg"]').boundingBox())!;
  const titleBox = (await title.boundingBox())!;
  expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(chevron.x);
  expect(await title.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(false);
});

test('Ordinary words stay whole in a squeezed row, and its value stays on screen', async ({ page }) => {
  const brokenWords = () => page.locator('.ld-row-title').evaluateAll((titles) => titles.flatMap((title) => {
    const broken: string[] = [];
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode as Text;
      for (const word of text.data.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(text, word.index);
        range.setEnd(text, word.index + word[0].length);
        if (new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size > 1) broken.push(word[0]);
      }
    }
    return broken;
  }));
  await page.setViewportSize({ width: 320, height: 640 });
  // The Inbox styles its own row titles, so the word check covers Settings; values stay on screen on both.
  for (const route of ['/app/settings', '/app/inbox']) {
    await page.goto(route);
    await expect(page.locator('.ld-row-title').first()).toBeVisible();
    await page.addStyleTag({ content: 'body { letter-spacing: .06em; }' }); // stands in for a wider system font
    if (route === '/app/settings') expect(await brokenWords()).toEqual([]);
    for (const value of await page.getByRole('main').locator('.ld-row-value').all()) expect((await value.boundingBox())!.x + (await value.boundingBox())!.width).toBeLessThanOrEqual(320);
  }
});

test('Initials come from the first and last names', async ({ page }) => {
  await openEditor(page);
  const initials = page.getByRole('main').locator('.ld-avatar');
  await expect(initials).toHaveText('HS');
  await page.getByLabel('Name').fill('Ana de la Ana');
  await saveButton(page).click();
  await expect(initials).toHaveText('AA');
});

test('Avatar shows a picture with alt text, initials without one, and initials if the picture fails', async ({ page }) => {
  await page.goto('/components');
  const section = page.getByRole('region', { name: 'Avatar' });
  await expect(section.locator('img[alt="Hana Sato"]')).toBeVisible();
  await expect(section.getByRole('img', { name: NAME }).last()).toHaveText('HS');

  await page.route('**/avatar-sample.svg', (route) => route.abort());
  await page.goto('/components');
  await expect(section.locator('img')).toHaveCount(0);
  await expect(section.getByRole('img', { name: NAME }).first()).toHaveText('HS');
  await expect(section.getByRole('img', { name: 'Ben Lindqvist' }).first()).toHaveText('BL');
});

test('Initials keep a flag or an emoji whole', async ({ page }) => {
  await openEditor(page);
  const initials = page.getByRole('main').locator('.ld-avatar');
  await page.getByLabel('Name').fill('🇵🇹 Sato');
  await saveButton(page).click();
  await expect(initials).toHaveText('🇵🇹S');
  await editButton(page).click();
  await page.getByLabel('Name').fill('👩🏽‍💻');
  await saveButton(page).click();
  await expect(initials).toHaveText('👩🏽‍💻');
});

test('Initials still work where Intl.Segmenter does not exist', async ({ page }) => {
  await page.addInitScript(() => { delete (Intl as { Segmenter?: unknown }).Segmenter; });
  await page.goto('/app/profile');
  await expect(page.getByRole('main').locator('.ld-avatar')).toHaveText('HS');
});

test('A stored profile keeps only its text fields, so a wrong type can\'t take the app down', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lede:profile', JSON.stringify({ name: null, role: 5, bio: null, location: 'Porto' })));
  await page.goto('/app');
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  await page.goto('/app/profile');
  await expect(heading(page, NAME)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Details' }).getByText('Porto', { exact: true })).toBeVisible();
  await editButton(page).click();
  await saveButton(page).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved');
});

test('Stored junk that isn\'t a profile at all reads as no profile', async ({ page }) => {
  for (const junk of ['null', '5', '[1]', '{not json']) {
    await page.goto('/');
    await page.evaluate((value) => localStorage.setItem('lede:profile', value), junk);
    await page.goto('/app/profile');
    await expect(heading(page, NAME)).toBeVisible();
  }
});

test('The profile still works when storage refuses to read or write', async ({ page }) => {
  await page.addInitScript(() => {
    const { getItem, setItem } = Storage.prototype;
    Storage.prototype.getItem = function (key) { if (key === 'lede:profile') throw new Error('Denied'); return getItem.call(this, key); };
    Storage.prototype.setItem = function (key, value) { if (key === 'lede:profile') throw new Error('Quota'); setItem.call(this, key, value); };
  });
  await openEditor(page);
  await page.getByLabel('Name').fill('Hana Mori');
  await saveButton(page).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved');
  await expect(heading(page, 'Hana Mori')).toBeVisible();
});

test.describe('A slow save', () => {
  const flow = (page: Page) => page.getByRole('region', { name: 'Slow save' });
  async function hold(page: Page) {
    await page.goto('/fixtures/profile');
    await flow(page).getByRole('button', { name: 'Edit profile' }).click();
    await flow(page).getByLabel('Role').fill('Typed before saving');
    await flow(page).getByLabel('Role').press('Enter');
    await expect(flow(page).getByRole('button', { name: 'Saving…' })).toBeVisible();
  }

  test('holds the form: typing changes nothing and focus stays', async ({ page }) => {
    await hold(page);
    const role = flow(page).getByLabel('Role');
    await expect(role).toBeFocused();
    await expect(role).not.toBeEditable();
    await page.keyboard.type(' and after');
    await expect(role).toHaveValue('Typed before saving');
    for (const label of ['Name', 'Email', 'Location', 'Short bio']) await expect(flow(page).getByLabel(label)).not.toBeEditable();
  });

  test('is announced, marks the form busy, and moves nothing', async ({ page }) => {
    await page.goto('/fixtures/profile');
    await flow(page).getByRole('button', { name: 'Edit profile' }).click();
    const top = async () => (await flow(page).locator('form').boundingBox())!.y;
    const before = await top();
    await flow(page).getByLabel('Role').press('Enter');
    await expect(flow(page).getByRole('status')).toHaveText('Saving…');
    await expect(flow(page).locator('form')).toHaveAttribute('aria-busy', 'true');
    expect(await top()).toBe(before);
    await flow(page).getByRole('button', { name: 'Refuse save', exact: true }).click();
    await expect(flow(page).getByRole('status')).toBeEmpty();
    await expect(flow(page).locator('form')).not.toHaveAttribute('aria-busy');
  });

  test('can\'t be sent twice or cancelled', async ({ page }) => {
    await hold(page);
    await page.keyboard.press('Enter');
    await expect(flow(page).getByText('Saves asked for: 1')).toBeVisible();
    await expect(flow(page).getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  test('closes the form once it finishes, and leaves focus where it was', async ({ page }) => {
    await hold(page);
    const finish = flow(page).getByRole('button', { name: 'Finish save' });
    await finish.click();
    await expect(flow(page).getByRole('status')).toHaveText('Profile saved');
    await expect(flow(page).getByText('Typed before saving', { exact: true })).toBeVisible();
    await expect(finish).toBeFocused();
  });

  test('hands the form back with the reason if it\'s refused with one', async ({ page }) => {
    await hold(page);
    await flow(page).getByRole('button', { name: 'Refuse save', exact: true }).click();
    await expect(flow(page).getByRole('alert')).toHaveText('The server is busy. Try again in a minute.');
    const role = flow(page).getByLabel('Role');
    await expect(role).toBeEditable();
    await expect(role).toHaveValue('Typed before saving');
    await expect(flow(page).getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  test('asks to try again if it\'s refused without a reason', async ({ page }) => {
    await hold(page);
    await flow(page).getByRole('button', { name: 'Refuse, no reason' }).click();
    await expect(flow(page).getByRole('alert')).toHaveText('Your changes weren’t saved. Your edits are still here, so try again.');
  });

  test('asks to try again if the reason is only whitespace', async ({ page }) => {
    await hold(page);
    await flow(page).getByRole('button', { name: 'Refuse, blank reason' }).click();
    await expect(flow(page).getByRole('alert')).toHaveText('Your changes weren’t saved. Your edits are still here, so try again.');
  });

  test('wraps a long reason at 320px, so nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await hold(page);
    const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await sideways()).toBeLessThanOrEqual(0);
    await flow(page).getByRole('button', { name: 'Refuse, long reason' }).click();
    await expect(flow(page).getByRole('alert')).toContainText('https://example.com/');
    expect(await sideways()).toBeLessThanOrEqual(0);
  });

  for (const mode of MODES) {
    test(`passes axe · ${mode.name}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: mode.scheme });
      await page.addInitScript((hc) => localStorage.setItem('lede:appearance', JSON.stringify({ highContrast: hc })), mode.hc);
      await hold(page);
      await expectNoViolations(page, 'saving');
    });
  }
});

test('Two flows on a page keep their fields apart', async ({ page }) => {
  await page.goto('/fixtures/profile');
  const [first, second] = [page.getByRole('region', { name: 'Slow save' }), page.getByRole('region', { name: 'Second flow' })];
  await first.getByRole('button', { name: 'Edit profile' }).click();
  await second.getByRole('button', { name: 'Edit profile' }).click();
  await second.getByLabel('Name').fill('');
  await second.getByRole('button', { name: 'Save changes' }).click();
  await expect(second.getByLabel('Name')).toBeFocused();
  expect(await page.locator('main [id]').evaluateAll((els) => els.length - new Set(els.map((e) => e.id)).size)).toBe(0);
});

for (const mode of MODES) {
  test(`Every state of the form passes axe · ${mode.name}`, async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: mode.scheme });
    await page.addInitScript((hc) => localStorage.setItem('lede:appearance', JSON.stringify({ highContrast: hc })), mode.hc);
    await openEditor(page);
    await expectNoViolations(page, 'editing');

    await page.getByLabel('Name').fill('');
    await page.getByLabel('Email').fill('hana@');
    await saveButton(page).click();
    await expect(page.getByRole('main').getByText('Enter your name.')).toBeVisible();
    await expectNoViolations(page, 'validation');

    await page.getByLabel('Name').fill(NAME);
    await page.getByLabel('Email').fill('hana@example.com');
    await context.setOffline(true);
    await saveButton(page).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expectNoViolations(page, 'failed');

    await context.setOffline(false);
    await saveButton(page).click();
    await expect(page.getByRole('status')).toHaveText('Profile saved');
    await expectNoViolations(page, 'saved');
  });
}
