import { expect, test } from '@playwright/test';
import { parseAnsi } from '../registry/lede/code-block';

// CodeBlock on the Components page: ANSI colors as tokens, a scroll area named once it overflows, and `follow`.
test('ANSI codes become styled runs, and every other escape is dropped with its text kept', () => {
  expect(parseAnsi('\x1b[31mred\x1b[0m plain \x1b[1;92mbold green\x1b[22m green\x1b[39m')).toEqual([
    { text: 'red', color: 'red' },
    { text: ' plain ' },
    { text: 'bold green', color: 'green', bold: true },
    { text: ' green', color: 'green' },
  ]);
  expect(parseAnsi('\x1b[38;5;208morange\x1b[0m \x1b[2K\x1b]8;;https://x.test\x07link\x1b]8;;\x07')).toEqual([{ text: 'orange link' }]);
  expect(parseAnsi('\x1b[44;37mon blue\x1b[m')).toEqual([{ text: 'on blue', color: 'white' }]);
});

test('a log shows ANSI colors as tokens, and follows its end as lines arrive', async ({ page }) => {
  await page.goto('/components');
  const block = page.locator('#c-code').locator('..').locator('.ld-code');
  await expect(block.locator('figcaption')).toHaveText('Deploy log');
  const ok = block.locator('.ld-ansi-green');
  await expect(ok).toHaveText('✓');
  const [green, success] = await ok.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(document.documentElement).getPropertyValue('--success')]);
  expect(green).toBe(await page.evaluate((c) => { const s = document.createElement('i'); s.style.color = c; document.body.append(s); const v = getComputedStyle(s).color; s.remove(); return v; }, success.trim()));
  // Escape codes never show as text.
  await expect(block.locator('pre')).not.toContainText('[');
  const add = page.getByRole('button', { name: 'Add a log line' });
  for (let i = 0; i < 3; i++) await add.click();
  const scroller = page.getByRole('region', { name: 'Deploy log' });
  await expect(scroller).toBeVisible();
  await expect(scroller).toHaveAttribute('tabindex', '0');
  await expect.poll(() => scroller.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(2);
  // Scrolled up, the reader keeps their place as a line arrives.
  await scroller.evaluate((el) => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')); });
  await add.click();
  await expect(scroller).toContainText('Traffic stays on v41');
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);
});

test('a block that fits is no region and takes no tab stop', async ({ page }) => {
  await page.goto('/components');
  await page.getByRole('button', { name: 'Start over' }).click();
  const pre = page.locator('#c-code').locator('..').locator('.ld-code-pre');
  await expect(pre).not.toHaveAttribute('tabindex');
  await expect(pre).not.toHaveAttribute('role');
});
