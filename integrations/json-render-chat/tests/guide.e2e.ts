import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The guide around the chat: three screens a link apart, each reply's account of how it was made, and README.md's
// sections drawn as pages.

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const composer = (page: Page) => page.getByRole('textbox', { name: 'Message' });
const nav = (page: Page) => page.getByRole('navigation', { name: 'Guide' });
const turns = (page: Page) => page.getByRole('region', { name: 'Conversation' }).getByRole('listitem').filter({ has: page.getByRole('heading', { level: 2 }) });
const trace = (page: Page, n = 1) => turns(page).nth(n).locator('.jrc-trace');
const h1 = (page: Page) => page.locator('h1:visible');

async function ask(page: Page, text: string) {
  await composer(page).fill(text);
  await composer(page).press('Enter');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
}
async function open(page: Page, n = 1) {
  await turns(page).nth(n).getByRole('button', { name: /How this reply was made/ }).click();
  return trace(page, n);
}

const sectionOf = (title: string) => readme.split(`\n## ${title}\n`)[1]!.split(/\n## /)[0]!;

/** The fenced code of one `## title` section of README.md, dedented, in order. */
function fences(title: string): string[] {
  const body = sectionOf(title);
  return [...body.matchAll(/^( *)```\w*\n([\s\S]*?)\n\1```$/gm)].map(([, indent, code]) => code!.split('\n').map((l) => l.slice(indent!.length)).join('\n'));
}

/**
 * The words of one `## title` section of README.md as a reader sees them, a block at a time: each paragraph, list item
 * and table row, with Markdown's marks gone. Quotes stay straight here, and `shows` straightens the page's, so which way
 * a curly quote faces is left to the literal checks.
 */
function prose(title: string): string[] {
  const words = (t: string) =>
    t.split(/(````.+?````|``.+?``|`[^`]+`)/).map((part, i) => (i % 2 ? part.replace(/^(`+)\s?(.*?)\s?\1$/, '$2') : part.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')))
      .join('').replace(/\[`?([^\]]+?)`?\]\([^)]+\)/g, '$1');
  const body = sectionOf(title).replace(/^( *)```\w*\n[\s\S]*?\n\1```$/gm, '');
  return body.split(/\n\s*\n/).flatMap((chunk) => {
    const lines = chunk.split('\n').map((l) => l.trim()).filter((l) => l && !/^\|[\s|:-]+\|$/.test(l));
    if (!lines.length) return [];
    if (lines[0]!.startsWith('|')) return lines.map((row) => words(row.slice(1, -1).split(' | ').map((c) => c.trim()).join(' ')));
    const blocks = lines.reduce<string[][]>((all, line) => (/^(\d+\.|-) /.test(line) || !all.length ? [...all, [line]] : (all.at(-1)!.push(line), all)), []);
    return blocks.map((block) => words(block.join(' ').replace(/^(\d+\.|-|#{2,6}) /, '')).replace(/\s+/g, ' ').trim());
  });
}

/** Expects the visible page to show each block, in order, reading its curly quotes as straight ones. */
async function shows(page: Page, blocks: string[]) {
  await expect(h1(page)).toHaveCount(1);
  const straight = (t: string) => t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  const text = straight((await page.getByRole('main').innerText()).replace(/\s+/g, ' '));
  let at = 0;
  for (const block of blocks.map(straight)) {
    const found = text.indexOf(block, at);
    expect(found, `the page shows “${block.slice(0, 80)}…” after what came before it`).toBeGreaterThanOrEqual(0);
    at = found + block.length;
  }
}

test('the navigation marks the current screen, each move lands on that screen’s one h1, and each screen has a link of its own', async ({ page }) => {
  await page.goto('/');
  await expect(nav(page).getByRole('link', { name: 'Try it' })).toHaveAttribute('aria-current', 'page');
  await expect(composer(page)).toBeFocused();
  for (const [name, hash, title] of [['How it works', '#/how-it-works', 'How it works'], ['Build it', '#/build', 'Build it'], ['Try it', '#/', 'Ask Daybook']] as const) {
    await nav(page).getByRole('link', { name }).click();
    await expect(page).toHaveURL(new RegExp(`${hash.replace('/', '\\/')}$`));
    await expect(nav(page).getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
    await expect(nav(page).locator('[aria-current]')).toHaveCount(1);
    await expect(h1(page)).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeFocused();
  }
  await page.goto('/#/build');
  await expect(page.getByRole('heading', { level: 1, name: 'Build it' })).toBeFocused();
});

test('the conversation stays while another screen shows, and Back returns to the control the person left', async ({ page }) => {
  await page.goto('/');
  await ask(page, 'How’s my week?');
  await nav(page).getByRole('link', { name: 'How it works' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'How it works' })).toBeFocused();
  await page.goBack();
  await expect(nav(page).getByRole('link', { name: 'How it works' })).toBeFocused();
  await expect(turns(page)).toHaveCount(2);
  await expect(turns(page).nth(1).getByRole('heading', { level: 3, name: 'Your week' })).toBeVisible();
});

test('a reply’s account is closed at first and shows what was sent, what streamed, the spec and the state now', async ({ page }) => {
  await page.goto('/');
  await ask(page, 'Show my tasks');
  const button = turns(page).nth(1).getByRole('button', { name: /How this reply was made/ });
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await expect(trace(page).locator('pre')).toHaveCount(0);
  const account = await open(page);
  await expect(account.getByRole('figure', { name: 'Your words' })).toHaveText(/Show my tasks/);
  const count = Number((await button.textContent())!.match(/(\d+) patches/)![1]);
  const patches = account.getByRole('figure', { name: /patches, in the order they arrived/ }).locator('pre');
  const lines = (await patches.textContent())!.split('\n').map((l) => JSON.parse(l) as { op: string; path: string });
  expect(lines).toHaveLength(count);
  expect(lines[0]).toMatchObject({ op: 'add', path: '/root' });
  const spec = JSON.parse((await account.getByRole('figure', { name: 'The spec' }).locator('pre').textContent())!) as { root: string; elements: Record<string, unknown> };
  expect(spec.elements[spec.root]).toBeTruthy();
  await turns(page).nth(1).getByRole('textbox', { name: 'Task' }).fill('Call Grace');
  await expect(account.getByRole('figure', { name: 'The screen’s state now' })).toContainText('"title": "Call Grace"');
  await expect(account.getByRole('link', { name: 'Read the system prompt' })).toBeVisible();
});

test('the account lists each action with its params, and one held back with the field that held it', async ({ page }) => {
  await page.goto('/');
  await ask(page, 'How’s my week?');
  await page.getByRole('button', { name: /Venue review/ }).click();
  await expect((await open(page)).getByRole('list', { name: 'Actions' })).toContainText(/open ran with \{"id":"[^"]+"\}/);
  await ask(page, 'Help me sign up');
  await turns(page).nth(3).getByRole('textbox', { name: 'Name' }).fill('Ada');
  await turns(page).nth(3).getByRole('button', { name: 'Create account' }).click();
  await expect((await open(page, 3)).getByRole('list', { name: 'Actions' })).toContainText('submit was held back by /form/email (“Enter an email address');
});

test('a follow-up’s account shows the state the person left in the earlier screen, as it was when they sent', async ({ page }) => {
  await page.goto('/');
  await ask(page, 'Show my notification settings');
  const email = turns(page).nth(1).getByRole('switch', { name: /Email alerts/ });
  await email.click();
  await ask(page, 'turn off push');
  await expect(turns(page).nth(3).getByRole('switch', { name: /Push alerts/ })).toHaveAttribute('aria-checked', 'false');
  await email.click();
  const sent = (await open(page, 3)).getByRole('figure', { name: 'The state of 1 earlier screen, sent as screens' });
  expect(Object.values(JSON.parse((await sent.locator('pre').textContent())!) as Record<string, { settings?: { email?: boolean } }>)[0]?.settings).toMatchObject({ email: true });
});

test('a retry’s account shows the state as the retry sent it', async ({ page }) => {
  await page.goto('/');
  await ask(page, 'Show my notification settings');
  const email = turns(page).nth(1).getByRole('switch', { name: /Email alerts/ });
  await email.click();
  await ask(page, 'Fail once');
  await email.click();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  const account = await open(page, 3);
  await expect(account.getByRole('figure', { name: 'Your words' })).toHaveText(/Fail once/);
  const sent = account.getByRole('figure', { name: 'The state of 1 earlier screen, sent as screens' });
  expect(Object.values(JSON.parse((await sent.locator('pre').textContent())!) as Record<string, { settings?: { email?: boolean } }>)[0]?.settings).toMatchObject({ email: false });
});

test('the suggestions stay after the first message, and a question no script matches says what the demo can answer', async ({ page }) => {
  await page.goto('/');
  await ask(page, 'What’s the weather?');
  await expect(turns(page).nth(1)).toContainText('This demo answers from a script, so it can’t answer that. Try one of these: “How’s my week?”, “Show my tasks”, “What’s in my inbox?” or “Show my notification settings”.');
  await expect(page.getByRole('list', { name: 'Suggestions' }).getByRole('button', { name: 'Fail once' })).toBeVisible();
});

test('a “Try” link pressed while a reply streams waits for it, then asks, with focus in the composer and never on <body>', async ({ page }) => {
  await page.goto('/');
  await composer(page).fill('Show my tasks');
  await composer(page).press('Enter');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await nav(page).getByRole('link', { name: 'How it works' }).click();
  await page.getByRole('link', { name: 'Try “What’s in my inbox?”' }).click();
  // Read at once, while the first reply still streams: the chat's own return to the composer comes only as it ends.
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName), { timeout: 500 }).toBe('TEXTAREA');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible({ timeout: 1 });
  await expect(page.getByText('Next, once this reply ends: “What’s in my inbox?”')).toBeVisible();
  const seen = new Set<string | undefined>();
  while (await page.getByRole('button', { name: 'Stop' }).isVisible()) seen.add(await page.evaluate(() => document.activeElement?.tagName));
  expect([...seen].filter((t) => t !== 'TEXTAREA')).toEqual([]);
  await expect(turns(page)).toHaveCount(4);
  await expect(turns(page).nth(2)).toContainText('What’s in my inbox?');
});

/** Slows the mock's stream, so a test can act while a reply is still streaming. */
const slow = (page: Page) => page.addInitScript(() => {
  const wait = window.setTimeout;
  window.setTimeout = ((f: TimerHandler, ms?: number, ...rest: unknown[]) => wait(f, ms === 60 ? 150 : ms, ...rest)) as typeof window.setTimeout;
});
const waiting = (page: Page) => page.locator('p.jrc-queued[role="status"]');
async function tryWhileStreaming(page: Page, ...questions: string[]) {
  await page.goto('/');
  await expect(waiting(page), 'the live region is there, empty, before anything waits').toBeAttached();
  await expect(waiting(page)).toHaveText('');
  await composer(page).fill('Show my tasks');
  await composer(page).press('Enter');
  for (const question of questions) {
    await nav(page).getByRole('link', { name: 'How it works' }).click();
    await page.getByRole('link', { name: `Try “${question}”` }).click();
    await expect(composer(page)).toBeFocused();
  }
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
}

test('a second “Try” link mid-stream takes the waiting question’s place, and the polite status says so', async ({ page }) => {
  await slow(page);
  await tryWhileStreaming(page, 'What’s in my inbox?', 'Help me sign up');
  await expect(waiting(page)).toHaveText('Next, once this reply ends: “Help me sign up”, in place of “What’s in my inbox?”.');
  await expect(turns(page)).toHaveCount(4, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  await expect(turns(page).nth(2)).toContainText('Help me sign up');
  await expect(turns(page).filter({ hasText: 'What’s in my inbox?' })).toHaveCount(0);
});

test('Escape backs out one layer: the first cancels the waiting question and the reply streams on, the next stops it', async ({ page }) => {
  await slow(page);
  await tryWhileStreaming(page, 'What’s in my inbox?');
  await expect(waiting(page)).toHaveText('Next, once this reply ends: “What’s in my inbox?”.');
  await composer(page).press('Escape');
  await expect(waiting(page)).toHaveText('You canceled “What’s in my inbox?”.');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await composer(page).press('Escape');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  await expect(waiting(page), 'the cancel’s note leaves with its reply').toHaveText('');
  await page.waitForTimeout(500);
  await expect(turns(page)).toHaveCount(2);
});

test('text typed while a question waits stays, and the question waits for a press of its own button', async ({ page }) => {
  await slow(page);
  await tryWhileStreaming(page, 'What’s in my inbox?');
  await composer(page).fill('and then my calendar');
  const send = page.getByRole('button', { name: 'Send “What’s in my inbox?”' });
  await expect(send).toBeVisible({ timeout: 30_000 });
  await expect(waiting(page)).toHaveText('“What’s in my inbox?” is ready to send, and your message stays in the composer.');
  await expect(turns(page)).toHaveCount(2);
  await expect(composer(page)).toHaveValue('and then my calendar');
  await send.click();
  await expect(turns(page)).toHaveCount(4);
  await expect(turns(page).nth(2)).toContainText('What’s in my inbox?');
  await expect(composer(page)).toHaveValue('and then my calendar');
  await expect(send).toBeHidden();
});

/** Leaves “What’s in my inbox?” held for its button, behind the draft “and then my calendar”. */
async function heldBehindDraft(page: Page) {
  await slow(page);
  await tryWhileStreaming(page, 'What’s in my inbox?');
  await composer(page).fill('and then my calendar');
  const send = page.getByRole('button', { name: 'Send “What’s in my inbox?”' });
  await expect(send).toBeVisible({ timeout: 30_000 });
  return send;
}

test('sending your own text while a question is held puts the question back to wait on that reply', async ({ page }) => {
  await heldBehindDraft(page);
  await composer(page).press('Enter');
  await expect(turns(page).nth(2)).toContainText('and then my calendar');
  await expect(waiting(page)).toHaveText('Next, once this reply ends: “What’s in my inbox?”.');
  await expect(turns(page)).toHaveCount(6, { timeout: 30_000 });
  await expect(turns(page).nth(4)).toContainText('What’s in my inbox?');
  await expect(waiting(page)).toHaveText('');
});

test('a new “Try” link while a question is held sends at once and drops the held one, its note and its button', async ({ page }) => {
  const send = await heldBehindDraft(page);
  await nav(page).getByRole('link', { name: 'How it works' }).click();
  await page.getByRole('link', { name: 'Try “Help me sign up”' }).click();
  await expect(turns(page).nth(2)).toContainText('Help me sign up');
  await expect(waiting(page)).toHaveText('');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden({ timeout: 30_000 });
  await expect(send).toBeHidden();
  await expect(composer(page)).toHaveValue('and then my calendar');
});

test('Escape on a held question’s button cancels it and moves focus to the composer', async ({ page }) => {
  const send = await heldBehindDraft(page);
  await send.focus();
  await send.press('Escape');
  await expect(waiting(page)).toHaveText('You canceled “What’s in my inbox?”.');
  await expect(send).toBeHidden();
  await expect(composer(page)).toBeFocused();
});

test('the system prompt opens from an account, and its back link returns to the link the person used', async ({ page }) => {
  await page.goto('/');
  await ask(page, 'How’s my week?');
  const link = (await open(page)).getByRole('link', { name: 'Read the system prompt' });
  await link.click();
  await expect(page.getByRole('heading', { level: 1, name: 'The system prompt' })).toBeFocused();
  await page.getByRole('main').getByRole('link', { name: 'Try it' }).click();
  await expect(link).toBeFocused();
});

const loop = [...sectionOf('How it works').matchAll(/^\d+\. \*\*(.+?)\.\*\*/gm)].map((m) => m[1]!);
/** Each step's own question, in the loop's order. */
const asks = ['How’s my week?', 'Show my notification settings', 'What’s in my inbox?', 'Show my tasks', 'Help me sign up'];

test('How it works shows README.md’s section, block for block, with its links pointing at the repo', async ({ page }) => {
  await page.goto('/#/how-it-works');
  await shows(page, prose('How it works'));
  await expect(page.getByRole('main')).toContainText('such as open with an item’s id. SpecView’s onStateChange gives the chat each screen’s state');
  await expect(page.getByRole('heading', { level: 2, name: 'The loop' })).toBeVisible();
  await expect(page.locator('ol.jrc-md-list > li > p:first-child > strong')).toHaveText(loop.map((t) => `${t}.`));
  await expect(page.getByRole('link', { name: '../json-render-chat-plain' })).toHaveAttribute('href', 'https://github.com/fairchild/lede-design/blob/main/integrations/json-render-chat/../json-render-chat-plain/README.md#side-by-side');
});

test('the loop at a glance links each step, and each step’s Try link asks that step’s own question, whose reply shows a screen', async ({ page }) => {
  await page.goto('/#/how-it-works');
  const glance = page.getByRole('list', { name: 'The loop at a glance' });
  const flow = glance.getByRole('link');
  await expect(flow).toHaveText(loop);
  await expect(page.locator('h2:has-text("The loop") + ol.jrc-flow'), 'the flow follows its heading').toHaveCount(1);
  await flow.nth(2).click();
  await expect(page.locator('#step-3')).toBeFocused();
  for (let n = 0; n < loop.length; n++) {
    await page.goto('about:blank');
    await page.goto('/#/how-it-works');
    const question = asks[n]!;
    await page.locator(`#step-${n + 1}`).getByRole('link', { name: `Try “${question}”` }).click();
    await expect(composer(page)).toBeFocused();
    await expect(turns(page).nth(0)).toContainText(question);
    await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
    await expect(turns(page).nth(1).locator('.jrc-screen').getByRole('heading', { level: 3 }), `step ${n + 1}’s question draws a screen`).toBeVisible();
  }
});

test('the second step’s follow-up, “turn off push”, answers with the settings screen and push off', async ({ page }) => {
  await page.goto('/');
  await ask(page, 'Show my notification settings');
  await ask(page, 'turn off push');
  await expect(turns(page).nth(3).getByRole('switch', { name: /Push alerts/ })).toHaveAttribute('aria-checked', 'false');
});

test('Build it shows README.md’s code, block for block, and Copy puts it on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#/build');
  await shows(page, [...prose('Hand this to your coding agent'), ...prose('Build this in your app')]);
  await expect(page.getByRole('link', { name: 'AGENTS.md' }).first()).toHaveAttribute('href', 'https://github.com/fairchild/lede-design/blob/main/integrations/json-render-chat/AGENTS.md');
  const shown = await page.locator('pre').allTextContents();
  expect(shown).toEqual([...fences('Hand this to your coding agent'), ...fences('Build this in your app')]);
  const rows = readme.split('\n## Build this in your app\n')[1]!.split(/\n## /)[0]!.match(/^ *\| `/gm)!.length;
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(rows + 1);
  const prompt = page.getByRole('figure', { name: 'Prompt for your coding agent' });
  await prompt.getByRole('button', { name: 'Copy' }).click();
  await expect(prompt.getByRole('status')).toHaveText('Copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(fences('Hand this to your coding agent')[0]);
});

for (const width of [390, 1280]) {
  for (const text of [16, 32]) {
    test(`each screen and an open account pass axe and fit the width at ${width}px and ${text === 16 ? '100' : '200'}% text, in each theme`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Page.setFontSizes', { fontSizes: { standard: text, fixed: text } });
      await page.goto('/');
      await ask(page, 'Help me sign up');
      await open(page);
      for (const [colorScheme, contrast] of [['light', 'no-preference'], ['dark', 'no-preference'], ['light', 'more'], ['dark', 'more']] as const) {
        // Reduced motion, so a theme's colors are whole when axe reads them, not partway through a transition.
        await page.emulateMedia({ colorScheme, contrast, reducedMotion: 'reduce' });
        for (const hash of ['#/', '#/how-it-works', '#/build', '#/prompt']) {
          await page.evaluate((h) => { location.hash = h; }, hash);
          await expect(h1(page)).toHaveCount(1);
          await expect(h1(page)).toBeFocused();
          await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
          const where = `${hash} ${colorScheme} ${contrast}`;
          expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => `${where}: ${v.id} ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
          expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), where).toBeLessThanOrEqual(0);
          const clipped = await page.evaluate(() => [...document.querySelectorAll('pre')].filter((pre) => pre.checkVisibility() && pre.scrollWidth > pre.clientWidth).length);
          expect(clipped, `${where}: code wider than its box`).toBe(0);
        }
      }
    });
  }
}
