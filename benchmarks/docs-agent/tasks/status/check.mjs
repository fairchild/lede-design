// What the status task asks for, checked in the built app. It's the held-out task: never change the docs because of
// how a run did here; read only its score.
import { countVisible, ok } from '../../checks.mjs';

export const holdout = true;
export const dataFile = 'status.json';

// The text of the smallest visible row-like element that holds `name` and more, so a service's own row.
const rowText = (page, name) =>
  page.evaluate((needle) => {
    let best = '';
    for (const el of document.body.querySelectorAll('li, tr, [role="row"], [role="listitem"], article, dl, section, div')) {
      const text = el.textContent ?? '';
      if (!el.getClientRects().length || !text.includes(needle) || text.length <= needle.length + 3 || text.length > 400) continue;
      if (!best || text.length < best.length) best = text;
    }
    return best;
  }, name);

export async function desktop(page, { services, incidents }) {
  const results = [];
  const text = await page.locator('body').innerText();
  const count = (status) => services.filter((s) => s.status === status).length;
  const near = (n, word) => new RegExp(`\\b${n}\\b[^\\n]{0,40}${word}|${word}[^\\n]{0,40}\\b${n}\\b`, 'i').test(text);
  results.push(ok('the counts by status are at the top', near(count('operational'), 'operational') && near(count('degraded'), 'degraded') && near(count('down'), 'down')));

  let shown = 0;
  let worded = 0;
  for (const s of services) {
    if (await countVisible(page.getByText(s.name, { exact: true }))) shown++;
    const row = await rowText(page, s.name);
    if (new RegExp(s.status, 'i').test(row) && row.includes(s.uptime90d)) worded++;
  }
  results.push(ok('every service is listed', shown === services.length, `${shown} of ${services.length}`));
  results.push(ok("each service's row says its status in words and its uptime", worded === services.length, `${worded} of ${services.length}`));

  let open = 0;
  for (const i of incidents) if ((await countVisible(page.getByText(i.title))) && new RegExp(i.state, 'i').test(await rowText(page, i.title))) open++;
  results.push(ok('each incident shows with its state', open === incidents.length, `${open} of ${incidents.length}`));
  return results;
}
