// What the servers task asks for, checked in the built app.
import { countVisible, ok, safely } from '../../checks.mjs';

export const holdout = false;
export const dataFile = 'servers.json';

const firstName = async (page, names) => {
  const rows = page.getByRole('row');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const text = (await safely(() => rows.nth(i).innerText())) ?? '';
    const found = names.find((n) => text.includes(n));
    if (found) return found;
  }
  return null;
};

export async function desktop(page, { servers }) {
  const results = [];
  const names = servers.map((s) => s.name);
  let headers = 0;
  for (const h of ['Name', 'Region', 'Status', 'CPU']) if (await countVisible(page.getByRole('columnheader', { name: new RegExp(h, 'i') }))) headers++;
  results.push(ok('the table has Name, Region, Status and CPU columns', headers === 4, `${headers} of 4`));
  results.push(ok('the table shows at least ten servers', (await page.getByRole('row').count()) >= 11));

  const search = (await countVisible(page.getByRole('searchbox'))) ? page.getByRole('searchbox').first() : page.getByRole('textbox', { name: /search|filter/i }).first();
  const target = servers[3].name;
  const other = servers[0].name;
  await safely(() => search.fill(target));
  await page.waitForTimeout(600);
  const shown = await countVisible(page.getByRole('row').filter({ hasText: target }));
  const hidden = await countVisible(page.getByRole('row').filter({ hasText: other }));
  results.push(ok('search filters the rows by name', shown > 0 && hidden === 0, `${target} shown ${shown}, ${other} shown ${hidden}`));
  await safely(() => search.fill(''));
  await page.waitForTimeout(400);

  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  const ends = [sorted[0], sorted.at(-1)];
  const header = page.getByRole('columnheader', { name: /name/i }).first();
  const button = header.getByRole('button');
  let sortedFirst = false;
  for (let click = 0; click < 2 && !sortedFirst; click++) {
    await safely(() => ((async () => ((await button.count()) ? button.first().click() : header.click()))()));
    await page.waitForTimeout(400);
    sortedFirst = ends.includes(await firstName(page, names));
  }
  results.push(ok('the Name column sorts', sortedFirst));
  return results;
}
