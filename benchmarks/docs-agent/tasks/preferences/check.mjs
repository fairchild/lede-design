// What the preferences task asks for, checked in the built app.
import { countVisible, ok, safely } from '../../checks.mjs';

export const holdout = false;
export const dataFile = 'preferences.json';

export async function desktop(page, { account, notifications }) {
  const results = [];
  const name = page.getByLabel(/^\s*(full )?name\s*$/i).first();
  const email = page.getByLabel(/e-?mail/i).first();
  results.push(ok('the name field holds the name', (await safely(() => name.inputValue())) === account.name));
  results.push(ok('the email field holds the email', (await safely(() => email.inputValue())) === account.email));

  let matching = 0;
  for (const n of notifications) if ((await safely(() => page.getByLabel(n.label).first().isChecked())) === n.on) matching++;
  results.push(ok('each notification switch starts as the data says', matching === notifications.length, `${matching} of ${notifications.length}`));

  const off = notifications.find((n) => !n.on);
  const toggle = page.getByLabel(off.label).first();
  await safely(() => toggle.click());
  results.push(ok('a notification switch turns on', (await safely(() => toggle.isChecked())) === true));

  const radio = page.getByRole('radio', { name: /system/i });
  const select = page.getByRole('combobox', { name: /theme/i });
  const system = (await countVisible(radio))
    ? await safely(() => radio.first().isChecked())
    : /system/i.test((await safely(() => select.first().evaluate((s) => s.selectedOptions[0]?.textContent ?? ''))) ?? '');
  results.push(ok('the theme starts at the same as the system', system === true));

  await safely(() => name.fill('Ada King'));
  await safely(() => page.getByRole('button', { name: /save/i }).first().click());
  await page.waitForTimeout(800);
  results.push(ok('Save says Saved', (await countVisible(page.getByText(/saved/i))) > 0));
  return results;
}
