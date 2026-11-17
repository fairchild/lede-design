// What the inbox task asks for, checked in the built app. `data` is the task's data.json.
import { countShownWhole, countVisible, ok } from '../../checks.mjs';

export const holdout = false;
export const dataFile = 'inbox.json';

const marker = (message) => `Full message ${message.id.slice(1)}:`;

export async function desktop(page, { messages }) {
  const results = [];
  let listed = 0;
  for (const m of messages) if (await countVisible(page.getByText(m.subject))) listed++;
  results.push(ok('lists every message', listed === messages.length, `${listed} of ${messages.length} subjects visible`));

  const [first, second] = messages;
  const before = await countShownWhole(page, marker(first));
  await page.getByText(first.subject).first().click();
  await page.waitForTimeout(600);
  const after = await countShownWhole(page, marker(first));
  results.push(ok('choosing a message shows it', after > before, `body shown ${before} → ${after}`));
  const body = page.getByText(marker(first)).last();
  const other = page.getByText(second.subject).first();
  const [bodyBox, otherBox] = [await body.boundingBox().catch(() => null), await other.boundingBox().catch(() => null)];
  results.push(ok('the list stays beside the message on a wide screen', Boolean(bodyBox && otherBox && otherBox.x + otherBox.width <= bodyBox.x + 1), 'next subject left of the open body'));
  return results;
}

export async function phone(page, { messages }) {
  const second = messages[1];
  const before = await countShownWhole(page, marker(second));
  await page.getByText(second.subject).first().click();
  await page.waitForTimeout(600);
  const after = await countShownWhole(page, marker(second));
  return [ok('choosing a message on a phone shows it', after > before, `body shown ${before} → ${after}`)];
}
