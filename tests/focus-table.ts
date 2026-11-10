// The keyboard and focus spec as data: where focus lands when each screen appears and after each action, what Enter and
// Escape do there, and the Tab stops around each landing. `focus-arrival.spec.ts`, `focus-actions.spec.ts` and
// `keyboard-paths.spec.ts` read it. The desktop project acts by keyboard and the phone project by touch, so the phone's
// columns are the touch ones.
//
// A row whose behavior isn't built yet says what it waits for (`pending`), and its test is `test.fixme` until the change
// that builds it deletes the marker. `FOCUS_PENDING=all npm test -- tests/focus- tests/keyboard-paths` runs every pending
// row, which fails until that change lands, and `FOCUS_PENDING=<text>` runs the rows whose reason contains the text.
// Every change that adds a screen or an action adds its rows here.
import { devices as browsers, test, expect, type Locator, type Page } from '@playwright/test';
import { expectLandsWithRows, expectNoBody, focusMoves, focusTrail, trailText, watchRows } from './focus-trail';

export type Device = 'desktop' | 'phone';
type Role = Parameters<Page['getByRole']>[0];

/** Where focus lands, found as assistive tech finds it: by role and accessible name, inside `in` when given. */
export interface Target { role: Role; name: string | RegExp; level?: number; in?: Target }
/** A landing spot that no role and name can find, such as a table's summary line, or a row focus lands in. */
export interface Spot { css: string; label: string; in?: Target; contains?: boolean }
export type Where = Target | Spot;

/** What the row waits for, and how today differs from the spec, such as `waits for Undo focus: focus stays on the notice`. The row is `test.fixme` until then. */
export type Pending = `waits for ${string}: ${string}`;

/** One value for both projects, or one each. */
export type Each<T> = T | { desktop: T; phone: T };
export const each = <T,>(value: Each<T>, device: Device): T =>
  value !== null && typeof value === 'object' && 'desktop' in value && 'phone' in value ? value[device] : (value as T);

export const h1 = (name: string | RegExp): Target => ({ role: 'heading', level: 1, name });
export const h2 = (name: string | RegExp): Target => ({ role: 'heading', level: 2, name });
export const link = (name: string | RegExp, within?: Target): Target => ({ role: 'link', name, in: within });
export const button = (name: string | RegExp, within?: Target): Target => ({ role: 'button', name, in: within });
export const field = (name: string): Target => ({ role: 'textbox', name });
export const radio = (name: string): Target => ({ role: 'radio', name });
const main: Target = { role: 'main', name: /.*/ };
const docsNav: Target = { role: 'navigation', name: 'Documentation' };
const appNav: Target = { role: 'navigation', name: 'App' };
const article: Target = { role: 'article', name: /.*/ };
const toolbar: Target = { role: 'toolbar', name: /selected/ };

export function locate(page: Page, where: Where): Locator {
  const scope = where.in ? locate(page, where.in) : page;
  if ('css' in where) return scope.locator(where.css).filter({ visible: true });
  return scope.getByRole(where.role, { name: where.name, level: where.level, exact: typeof where.name === 'string' });
}

export const describe = (where: Where): string =>
  'css' in where ? where.label : `${where.role}${where.level ? ` ${where.level}` : ''} ${typeof where.name === 'string' ? `“${where.name}”` : where.name}`;

/** Focus is on `where`, `where` is in view, and focus took no frame on `<body>` on the way, unless told otherwise. */
export async function expectLanding(page: Page, where: Where, how: string, { inView = true, body = true } = {}) {
  const el = locate(page, where);
  try {
    if ('css' in where && where.contains) await expect.poll(() => el.evaluate((e) => e.contains(document.activeElement))).toBe(true);
    else await expect(el).toBeFocused();
  } catch (error) {
    const reason = (error as Error).message.split('\n')[0];
    throw new Error(`${how}: focus isn’t on ${describe(where)}. Its trail: ${trailText(await focusTrail(page))}. (${reason})`);
  }
  if (inView) await expect(el, `${how}: ${describe(where)} is in view`).toBeInViewport();
  if (body) expectNoBody(await focusTrail(page));
}

/** Whether `where` draws Lede's ring: an outline in the color `--ring` resolves to there. */
export const ringShows = (page: Page, where: Where) => locate(page, where).evaluate((e) => {
  const { outlineStyle, outlineWidth, outlineColor } = getComputedStyle(e);
  const probe = document.createElement('i');
  probe.style.color = 'var(--ring)';
  e.parentElement!.append(probe);
  const ring = getComputedStyle(probe).color;
  probe.remove();
  return outlineStyle !== 'none' && parseFloat(outlineWidth) > 0 && outlineColor === ring;
});

/** The titles a screen lands on: PageHeader's, InboxFlow's message title and WorkbenchShell's. */
const TITLES = ['ld-page-title', 'ld-message-title', 'ld-wb-title'];

/** A title focus lands on shows the ring after a keyboard move, and not after a pointer move or a cold load. */
export async function expectTitleRing(page: Page, where: Where, keyboard: boolean, how: string) {
  if ('css' in where || where.role !== 'heading') return;
  if (!(await locate(page, where).evaluate((e, titles) => titles.some((t) => e.classList.contains(t)), TITLES))) return;
  expect(await ringShows(page, where), `${how}: ${describe(where)} ${keyboard ? 'shows' : 'shows no'} focus ring`).toBe(keyboard);
}

/** Activates a control the way each project does: by keyboard on desktop, by touch on a phone. */
export interface Driver {
  page: Page;
  device: Device;
  /** Focus and a key press on desktop (Enter, or `key`), a tap on a phone. */
  press(where: Where | Locator, key?: string): Promise<void>;
  /** Opens a row's ••• menu and chooses an item from it. */
  choose(more: Where | Locator, item: string): Promise<void>;
}

export function driver(page: Page, device: Device): Driver {
  const find = (w: Where | Locator) => ('page' in w && typeof w.page === 'function' ? (w as Locator) : locate(page, w as Where)).first();
  const press = async (w: Where | Locator, key = 'Enter') => {
    const control = find(w);
    if (device === 'phone') return control.tap();
    await control.focus();
    await page.keyboard.press(key);
  };
  return {
    page, device, press,
    choose: async (more, item) => {
      await press(more);
      await press(page.getByRole('menuitem', { name: item }));
    },
  };
}

// ——— Arrival: where focus lands when a screen appears (spec §3) ———

/**
 * How a screen is reached: a cold load, a link in, Back to where the link was, and Forward again; the Tab stops around
 * the landing; and `body`, no frame on `<body>` across those three route changes.
 */
export type Case = 'cold' | 'link' | 'back' | 'forward' | 'tabs' | 'body';

export interface Arrival {
  /** The URL a cold load opens. */
  route: string;
  /** Where focus lands on a cold load, a link in and Forward. */
  arrival: Each<Target>;
  /** Gets the onboarding draft to this step, so the cold load is a reload of it. */
  setup?: (page: Page) => Promise<void>;
  /** A link into the route from `from`, and where Back from the route puts focus there. */
  via?: { from: string; link: Target; back: Each<Target> };
  /** The Tab stops after the arrival target, and the one Shift+Tab stop before it. */
  tabs?: Each<Target[]>;
  shiftTab?: Each<Target>;
  /** What Enter at arrival does, on `only` when one project lands where Enter does nothing. Without it, Enter does nothing. */
  enter?: { url: RegExp; target: Each<Target>; pending?: Each<Pending | undefined>; only?: Device };
  /** What Escape does once the screen is reached by `via`, or cold without one. Without it, Escape does nothing. */
  escape?: { url: RegExp; target: Each<Target>; pending?: Each<Pending | undefined> };
  pending?: Partial<Record<Case, Each<Pending | undefined>>>;
}

/** Routes in `tests/routes.ts` that the spec leaves out: fixture pages follow the blocks they host. */
export const UNTABLED = new Set(['/fixtures/data-table', '/fixtures/segmented-control', '/fixtures/list-row', '/fixtures/page-header', '/fixtures/inbox/m6']);

/** Gets an onboarding draft to `step` (1 Preferences, 2 Review, 3 Done), using the pointer: the arrival is the test. */
const onboardTo = (step: 1 | 2 | 3) => async (page: Page) => {
  await page.goto('/app/welcome');
  for (const [n, next] of [[1, 'preferences'], [2, 'review'], [3, 'done']] as const) {
    if (n > step) break;
    await page.getByRole('button', { name: n === 3 ? 'Finish' : 'Continue' }).click();
    await page.waitForURL(`**/app/welcome/${next}`);
  }
};

/** Side by side, a message that scrolls in its pane is a focusable region. */
const textRegion: Target = { role: 'region', name: 'Message text' };
const message = (subject: string | RegExp) => ({ desktop: h2(subject), phone: h1(subject) });

export const ARRIVALS: Arrival[] = [
  // Docs places: the h1. A nav link lies outside <main>, so Back returns to the h1 there too.
  {
    route: '/', arrival: h1('Lede'),
    via: { from: '/components', link: link('Overview', docsNav), back: h1('Components') },
    tabs: [link('Foundations', main), link('Components', main), link('Blocks', main)],
  },
  {
    route: '/#install', arrival: h2('Install'),
    via: { from: '/layouts', link: link('Overview → Install', main), back: link('Overview → Install', main) },
  },
  {
    route: '/foundations', arrival: h1('Foundations'),
    via: { from: '/', link: link('Foundations', main), back: link('Foundations', main) },
  },
  { route: '/components', arrival: h1('Components'), via: { from: '/', link: link('Components', docsNav), back: h1('Lede') } },
  { route: '/blocks', arrival: h1('Blocks'), via: { from: '/', link: link('Blocks', docsNav), back: h1('Lede') } },
  { route: '/layouts', arrival: h1('Layouts'), via: { from: '/', link: link('Layouts', docsNav), back: h1('Lede') } },
  {
    route: '/blocks/data-table', arrival: h1('Data table'),
    via: { from: '/blocks', link: link('Data table guide and examples'), back: link('Data table guide and examples') },
    escape: { url: /\/blocks$/, target: link('Data table guide and examples') },
  },
  {
    route: '/blocks/data-table#dt-server', arrival: h2('Server mode'),
    via: { from: '/blocks/data-table/items/WI-1001?from=dt-server', link: link('Data table', main), back: link('Data table', main) },
    escape: { url: /\/blocks$/, target: h1('Blocks') },
  },
  {
    route: '/blocks/data-table/items/WI-1001', arrival: h1('Renew the Figma team licenses'),
    via: {
      from: '/blocks/data-table',
      link: link('WI-1001', { role: 'region', name: 'Client mode' }),
      back: link('WI-1001', { role: 'region', name: 'Client mode' }),
    },
    shiftTab: link('Data table', main),
    escape: { url: /\/blocks\/data-table#dt-client$/, target: h2('Client mode') },
  },
  {
    route: '/layouts/sidebar', arrival: h1('Overview'),
    via: { from: '/layouts', link: link('Open full page: Full page with left bar'), back: link('Open full page: Full page with left bar') },
    escape: { url: /\/layouts$/, target: link('Open full page: Full page with left bar') },
  },
  {
    route: '/layouts/sidebar#projects', arrival: { role: 'region', name: 'Projects' },
    escape: { url: /\/layouts$/, target: h1('Layouts') },
  },
  {
    route: '/decisions', arrival: h1('Decisions'),
    via: { from: '/', link: link('Decisions: how Lede is built and checked'), back: link('Decisions: how Lede is built and checked') },
    tabs: [button(/^Semantic HTML first/)],
    shiftTab: link('Overview', main),
    escape: { url: /:\d+\/$/, target: link('Decisions: how Lede is built and checked') },
  },
  {
    route: '/layouts/workbench', arrival: h1('retry.ts'),
    via: { from: '/layouts', link: link('Open full page: Three panels with top bar'), back: link('Open full page: Three panels with top bar') },
  },

  // Daybook.
  {
    route: '/app', arrival: h1('Today'),
    via: { from: '/app/inbox', link: link('Today', appNav), back: h1('Inbox') },
    tabs: [link('Decisions', main), link('Inbox', main), button(/^Decisions/)],
  },
  {
    route: '/app/inbox', arrival: h1('Inbox'),
    via: { from: '/app', link: link('Inbox', main), back: link('Inbox', main) },
    tabs: [button('Select'), link(/Team offsite in March/), button(/^More actions for Team offsite/)],
  },
  {
    route: '/app/inbox/m1', arrival: message('Q4 budget needs your approval'),
    via: { from: '/app', link: link('Decisions', main), back: link('Decisions', main) },
    escape: { url: /\/app\/inbox$/, target: link(/Q4 budget needs your approval/) },
  },
  {
    route: '/app/inbox/m5', arrival: message(/^Records migration review/),
    tabs: { desktop: [textRegion], phone: [link('Today', appNav)] },
    shiftTab: button('Delete', article),
    escape: { url: /\/app\/inbox$/, target: link(/Records migration review/) },
  },
  {
    route: '/app/inbox/m6', arrival: message('Team offsite in March: venue, dates and who runs which session'),
    via: { from: '/app/inbox', link: link(/Team offsite in March/), back: link(/Team offsite in March/) },
    tabs: { desktop: [textRegion], phone: [button(/^Priya Raman 10:26/)] },
    shiftTab: button('Delete', article),
    escape: { url: /\/app\/inbox$/, target: link(/Team offsite in March/) },
  },
  {
    route: '/app/inbox/nope', arrival: { desktop: h2('Message not found'), phone: h1('Message not found') },
    escape: { url: /\/app\/inbox$/, target: h1('Inbox') },
  },
  {
    route: '/app/work', arrival: h1('Work'),
    via: { from: '/app', link: link('Work', appNav), back: h1('Today') },
  },
  {
    route: '/app/work/WI-1001', arrival: h1('Renew the Figma team licenses'),
    via: { from: '/app/work', link: link(/\bWI-1001\b/), back: link(/\bWI-1001\b/) },
    tabs: [button('Archive', main)],
    shiftTab: link('Work', main),
    escape: { url: /\/app\/work$/, target: link(/\bWI-1001\b/) },
  },
  {
    route: '/app/work/WI-9999', arrival: h1('Not found'),
    shiftTab: link('Work', main),
    escape: { url: /\/app\/work$/, target: h1('Work') },
  },
  {
    route: '/app/settings', arrival: h1('Settings'),
    via: { from: '/app', link: link('Settings', appNav), back: h1('Today') },
    tabs: [link(/^Hana Sato/, main), link(/^Appearance/), { role: 'switch', name: 'Daily brief' }],
  },
  {
    route: '/app/settings/appearance', arrival: h1('Appearance'),
    via: { from: '/app/settings', link: link(/^Appearance/), back: link(/^Appearance/) },
    tabs: [radio('Automatic'), radio('Blue'), radio('Soft')],
    escape: { url: /\/app\/settings$/, target: link(/^Appearance/) },
  },
  {
    route: '/app/profile', arrival: h1('Hana Sato'),
    via: { from: '/app/settings', link: link(/^Hana Sato/, main), back: link(/^Hana Sato/, main) },
    tabs: [button('Edit profile')],
    shiftTab: link('Settings', main),
    escape: { url: /\/app\/settings$/, target: link(/^Hana Sato/, main) },
  },

  // Onboarding: the cursor goes where typing is next on a keyboard, and to the h1 on touch (spec §5).
  {
    route: '/app/welcome', arrival: { desktop: field('Name'), phone: h1('Create your account') },
    via: { from: '/app/settings', link: link('Replay onboarding'), back: link('Replay onboarding') },
    tabs: { desktop: [field('Email'), button('Continue')], phone: [field('Name'), field('Email'), button('Continue')] },
    shiftTab: link('Cancel'),
    enter: { url: /\/app\/welcome\/preferences$/, target: radio('Blue'), only: 'desktop' },
    escape: { url: /\/app\/settings$/, target: link('Replay onboarding') },
  },
  {
    route: '/app/welcome/preferences', arrival: radio('Blue'), setup: onboardTo(1),
    tabs: [{ role: 'switch', name: 'Send me a daily brief' }, radio('Morning'), button('Back')],
    enter: { url: /\/app\/welcome\/review$/, target: button('Finish') },
    escape: { url: /\/app$/, target: h1('Today') },
  },
  {
    route: '/app/welcome/review', arrival: button('Finish'), setup: onboardTo(2),
    shiftTab: button('Back'),
    enter: { url: /\/app\/welcome\/done$/, target: link('Get started') },
    escape: { url: /\/app$/, target: h1('Today') },
  },
  {
    route: '/app/welcome/done', arrival: link('Get started'), setup: onboardTo(3),
    enter: { url: /\/app$/, target: h1('Today') },
  },
  {
    route: '/app/nope', arrival: h1('Page not found'),
    shiftTab: link('Today', main),
    escape: { url: /\/app$/, target: h1('Today') },
  },
  { route: '/missing', arrival: h1('Page not found'), tabs: [link('Go to the overview')] },
];

// ——— Actions: where focus lands after each action (spec §4) ———

/** What a row checks after its action: the landing and the URL, no frame on <body>, the announcement's order, and more. */
export type Part = 'target' | 'body' | 'says' | 'check';

export interface Action {
  screen: string;
  action: string;
  /** Opens the screen and gets to the moment before the action. */
  setup: (d: Driver) => Promise<void>;
  act: (d: Driver) => Promise<void>;
  /** Where focus lands, and the URL then when the action changes it. */
  target: Each<Where>;
  url?: RegExp;
  /**
   * An outcome announcement that must come after the focus move (spec §1.5). This orders tasks only: the announcement's
   * time is read when the MutationObserver runs, at the end of the task, so a status added before `focus()` in the same
   * task still counts as after it.
   */
  says?: string | RegExp;
  /** Anything else the row states. */
  check?: (d: Driver) => Promise<void>;
  /**
   * Waits for the result of an action that ends after a round trip or a re-render, such as re-sorted rows or an alert,
   * before anything is checked. Without it, the landing could be read before the result moves focus. It waits only for
   * what today's code does too, so a pending row fails on its landing and doesn't time out here.
   */
  done?: (d: Driver) => Promise<void>;
  /** Whether the row checks the landing is in view. Arrivals always do. An action's row checks it where the action scrolls to its landing. */
  inView?: boolean;
  /** The project the action exists on, when only one has it. */
  only?: Device;
  /**
   * A phone row that only a finger can drive, such as a swipe. There's no strict phone project, so strict-desktop also
   * runs it with the phone's viewport and touch, and StrictMode's replayed effects still see the touch path.
   */
  strictTouch?: boolean;
  /** Overrides the project's viewport, as the long-list rows do. */
  viewport?: Each<{ width: number; height: number }>;
  pending?: Partial<Record<Part, Each<Pending | undefined>>>;
}

const inbox = async ({ page }: Driver) => { await page.goto('/app/inbox'); };
/** The Inbox fixture, whose Undo renders its restore a moment after the press. */
const inboxLater = async ({ page }: Driver) => { await page.goto('/fixtures/inbox?undo=later'); };
/**
 * Swipes a row open by touch, as row-menu.spec.ts does, and taps one of the actions it reveals. The finger rests before
 * it lifts: a lift while moving starts a fling, and Chromium on Linux turns a tap during a fling into no click.
 */
const swipeTo = async ({ page }: Driver, subject: string, action: string) => {
  const wrap = page.locator('.ld-row-wrap').filter({ hasText: subject });
  const box = (await wrap.boundingBox())!;
  const y = box.y + box.height / 2;
  const x0 = box.x + box.width * 0.5;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - i * 20, y }] });
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - 200, y }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(wrap).toHaveClass(/ld-row-open/);
  await wrap.locator('.ld-row-action', { hasText: action }).tap();
};
const work = async ({ page }: Driver) => {
  await page.goto('/app/work');
  await page.locator('[data-row-id]').first().waitFor();
};
const row = (id: string) => link(new RegExp(`\\b${id}\\b`));
const more = (subject: string | RegExp) => button(typeof subject === 'string' ? `More actions for ${subject}` : subject);
const SERVER = 'section[aria-labelledby="dt-server"]';
const ringOf = (el: Locator) => el.evaluate((e) => {
  const { outlineStyle, outlineWidth } = getComputedStyle(e);
  return { visible: e.matches(':focus-visible') && parseFloat(outlineWidth) > 0, style: outlineStyle };
});
const SUMMARY: Spot = { css: '.ld-dt-summary', label: 'the table summary line' };
/** A window just short enough that the receipt's row, once it moves up a place, sits under the phone's tab bar. */
const TAB_BAR_HEIGHT = 640;
const removal = { role: 'region', name: 'Removal' } as const;
const removalRow = (id: string, label: string): Spot => ({ css: `[data-row-id="${id}"] [data-row-link]`, in: removal, label });
/** Marks when the act starts, for `movesOnce`. */
const marked = (act: (d: Driver) => Promise<void>) => async (d: Driver) => {
  await d.page.evaluate(() => { (window as unknown as { actedAt: number }).actedAt = performance.now(); });
  await act(d);
};
/** Focus moved once after a `marked` act, besides onto the control pressed: a move a frame late lands somewhere first. */
const movesOnce = (pressed: RegExp, to: RegExp) => async ({ page }: Driver) => {
  const at = await page.evaluate(() => (window as unknown as { actedAt: number }).actedAt);
  const moves = (await focusMoves(page)).filter((m) => m.t > at && !pressed.test(m.focus)).map((m) => m.focus);
  expect(moves.length === 1 && to.test(moves[0]), `focus moves once, to ${to}: ${moves.join(' → ')}`).toBe(true);
};
const ARCHIVE = /^button “Archive”$/;
/** How far the receipt row's foot sits below the top of the phone's tab bar. */
const footBelowBar = async (page: Page) => {
  const row = (await locate(page, link(/Your receipt for October/)).boundingBox())!;
  const bar = (await page.locator('.ld-shell-tabbar > *').boundingBox())!;
  return row.y + row.height - bar.y;
};
/** ListFocusFixtures and MasterDetailFixtures: a list whose row actions remove rows, and a MasterDetail with no focus code. */
const listFocus = async ({ page }: Driver) => { await page.goto('/fixtures/list-focus'); };
const masterDetail = async ({ page }: Driver) => { await page.goto('/fixtures/master-detail'); };
const stackedView = { desktop: { width: 800, height: 800 }, phone: { width: 412, height: 800 } };
const removalFixture = async ({ page }: Driver) => {
  await page.goto('/fixtures/data-table');
  await page.getByRole('region', { name: 'Removal' }).locator('[data-row-id="n0"]').waitFor();
};

export const ACTIONS: Action[] = [
  // Inbox. The rows, newest first: Team offsite (m6), Records migration (m5), Q4 budget (m1), Launch date (m2), Design
  // review, Your receipt for October.
  {
    screen: 'Inbox', action: 'Open a message from its row', setup: inbox,
    act: (d) => d.press(link(/Launch date: Tuesday or Thursday/)),
    target: message('Launch date: Tuesday or Thursday?'), url: /\/app\/inbox\/m2$/,
    // Enter on desktop shows the title's ring, and a tap on a phone doesn't.
    check: (d) => expectTitleRing(d.page, each(message('Launch date: Tuesday or Thursday?'), d.device), d.device === 'desktop', 'Open a message'),
  },
  {
    // Side by side, the open message's row links to the URL already shown, so nothing remounts.
    screen: 'Inbox', action: 'Enter on the open message’s row', only: 'desktop',
    setup: async ({ page }) => { await page.goto('/app/inbox/m2'); await locate(page, link(/Launch date: Tuesday or Thursday/)).focus(); },
    act: ({ page }) => page.keyboard.press('Enter'),
    target: h2('Launch date: Tuesday or Thursday?'), url: /\/app\/inbox\/m2$/,
    check: (d) => expectTitleRing(d.page, h2('Launch date: Tuesday or Thursday?'), true, 'Enter on the open row'),
  },
  {
    // Another message's row opens that message: its title takes focus once, with no stop on the title it replaces.
    screen: 'Inbox', action: 'Open another message side by side', only: 'desktop',
    setup: async ({ page }) => { await page.goto('/app/inbox/m1'); await locate(page, link(/Launch date: Tuesday or Thursday/)).focus(); },
    act: marked(({ page }) => page.keyboard.press('Enter')),
    target: h2('Launch date: Tuesday or Thursday?'), url: /\/app\/inbox\/m2$/,
    check: movesOnce(/^a “/, /^h2 “Launch date/),
  },
  {
    screen: 'Inbox', action: 'Archive on the open message',
    setup: async (d) => { await inbox(d); await d.press(link(/Launch date: Tuesday or Thursday/)); },
    act: marked((d) => d.press(button('Archive', article))),
    target: link(/Design review agenda/), url: /\/app\/inbox$/,
    says: 'Archived 1 message. Undo',
    check: movesOnce(ARCHIVE, /Design review agenda/),
  },
  {
    // Stacked, the page scrolls to the top in a later commit than the landing, so the row scrolls back into view.
    screen: 'Inbox', action: 'Archive on the open message, its row low in the list', only: 'phone',
    viewport: { desktop: { width: 390, height: 440 }, phone: { width: 390, height: 440 } },
    setup: async (d) => {
      await inbox(d);
      const receipt = locate(d.page, link(/Your receipt for October/));
      await receipt.scrollIntoViewIfNeeded();
      await d.press(receipt);
      await d.page.waitForURL('**/app/inbox/m*');
    },
    act: (d) => d.press(button('Archive', article)),
    target: link(/Design review agenda/), url: /\/app\/inbox$/, inView: true,
  },
  {
    // The list hides as the layout switches, and whether the row still has focus when the title's effect runs varies
    // from run to run, so the act narrows the window 50 times, which meets both orders in about 95% of runs.
    screen: 'Inbox', action: 'Narrow the window with focus on a row', only: 'desktop',
    setup: async ({ page }) => { await page.goto('/app/inbox/m1'); },
    act: async ({ page }) => {
      for (let i = 0; i < 50; i++) {
        await page.setViewportSize({ width: 1280, height: 800 });
        await locate(page, h2('Q4 budget needs your approval')).waitFor();
        await locate(page, link(/Launch date: Tuesday or Thursday/)).focus();
        await page.setViewportSize({ width: 800, height: 800 });
        await expect(locate(page, h1('Q4 budget needs your approval')), `narrowing ${i + 1}`).toBeFocused();
      }
    },
    target: h1('Q4 budget needs your approval'),
  },
  {
    screen: 'Inbox', action: 'Row ••• → Archive', setup: inbox,
    act: (d) => d.choose(more('Launch date: Tuesday or Thursday?'), 'Archive'),
    target: link(/Design review agenda/),
  },
  {
    screen: 'Inbox', action: 'Row ••• → Archive on the last row, far down the list', setup: inbox,
    viewport: { desktop: { width: 1280, height: 420 }, phone: { width: 412, height: 500 } },
    act: (d) => d.choose(more('Your receipt for October'), 'Archive'), inView: true,
    target: link(/Design review agenda/),
  },
  {
    // A Delete samples the trail as an Archive does.
    screen: 'Inbox', action: 'Row ••• → Delete', setup: inbox,
    act: (d) => d.choose(more('Launch date: Tuesday or Thursday?'), 'Delete'),
    target: link(/Design review agenda/),
  },
  {
    screen: 'Inbox', action: 'Swipe → Archive', setup: inbox, only: 'phone', strictTouch: true,
    act: (d) => swipeTo(d, 'Launch date: Tuesday or Thursday?', 'Archive'),
    target: link(/Design review agenda/),
  },
  {
    screen: 'Inbox', action: 'Swipe → Delete', setup: inbox, only: 'phone', strictTouch: true,
    act: (d) => swipeTo(d, 'Launch date: Tuesday or Thursday?', 'Delete'),
    target: link(/Design review agenda/),
  },
  {
    // At 390px the tab bar floats over the foot of the page. The row that takes the removed one's place sits under it
    // until it scrolls clear.
    screen: 'Inbox', action: 'Row ••• → Archive, the next row above the tab bar', only: 'phone',
    viewport: { desktop: { width: 390, height: TAB_BAR_HEIGHT }, phone: { width: 390, height: TAB_BAR_HEIGHT } },
    setup: async (d) => {
      await inbox(d);
      await locate(d.page, button('More actions for Design review agenda')).scrollIntoViewIfNeeded();
      expect(await footBelowBar(d.page), 'before the act, the next row’s foot is under the tab bar').toBeGreaterThan(0);
    },
    act: (d) => d.choose(more('Design review agenda'), 'Archive'),
    target: link(/Your receipt for October/), inView: true,
    check: async ({ page }) => {
      expect(await footBelowBar(page), 'the landed row’s foot is above the tab bar').toBeLessThanOrEqual(0);
    },
  },
  {
    // A screen reader can open a message without focus on its row, so the list's place on record is another row. The
    // return to that record comes after Archive's own move, in the same commit, and yields to it.
    screen: 'Inbox', action: 'Archive on a message opened with focus elsewhere in the list',
    setup: async (d) => {
      await inbox(d);
      await locate(d.page, link(/Team offsite in March/)).focus();
      await locate(d.page, link(/Launch date: Tuesday or Thursday/)).evaluate((a: HTMLElement) => a.click());
      await d.page.waitForURL('**/app/inbox/m2');
      await expect(locate(d.page, each(message('Launch date: Tuesday or Thursday?'), d.device))).toBeFocused();
    },
    act: marked((d) => d.press(button('Archive', article))),
    target: link(/Design review agenda/), url: /\/app\/inbox$/,
    check: movesOnce(ARCHIVE, /Design review agenda/),
  },
  {
    screen: 'Inbox', action: 'Bulk Archive of every message',
    setup: async (d) => {
      await inbox(d);
      await d.press(button('Select'));
      for (const box of await d.page.getByRole('checkbox').all()) await d.press(box, 'Space');
    },
    act: (d) => d.press(button('Archive', toolbar)),
    target: h1('Inbox'),
  },
  {
    screen: 'Inbox', action: 'Select', setup: inbox,
    act: (d) => d.press(button('Select')),
    target: { role: 'checkbox', name: /Team offsite in March/ },
  },
  {
    screen: 'Inbox', action: 'Tick a checkbox',
    setup: async (d) => { await inbox(d); await d.press(button('Select')); },
    act: (d) => d.press({ role: 'checkbox', name: /Team offsite in March/ }, 'Space'),
    target: { role: 'checkbox', name: /Team offsite in March/ },
  },
  {
    screen: 'Inbox', action: 'Bulk Archive',
    setup: async (d) => { await inbox(d); await d.press(button('Select')); await d.press({ role: 'checkbox', name: /Team offsite in March/ }, 'Space'); },
    act: (d) => d.press(button('Archive', toolbar)),
    target: link(/Records migration review/),
  },
  {
    screen: 'Inbox', action: 'Bulk Delete',
    setup: async (d) => { await inbox(d); await d.press(button('Select')); await d.press({ role: 'checkbox', name: /Team offsite in March/ }, 'Space'); },
    act: (d) => d.press(button('Delete', toolbar)),
    target: link(/Records migration review/),
  },
  {
    // The place is the first message removed, whatever order they were ticked in.
    screen: 'Inbox', action: 'Bulk Archive of two apart',
    setup: async (d) => {
      await inbox(d);
      await d.press(button('Select'));
      await d.press({ role: 'checkbox', name: /Q4 budget needs your approval/ }, 'Space');
      await d.press({ role: 'checkbox', name: /Team offsite in March/ }, 'Space');
    },
    act: (d) => d.press(button('Archive', toolbar)),
    target: link(/Records migration review/),
  },
  {
    screen: 'Inbox', action: 'SelectionBar Done',
    setup: async (d) => { await inbox(d); await d.press(button('Select')); await d.press({ role: 'checkbox', name: /Team offsite in March/ }, 'Space'); },
    act: (d) => d.press(button('Done', toolbar)),
    target: button('Select'),
  },
  {
    screen: 'Inbox', action: 'Escape while selecting',
    setup: async (d) => { await inbox(d); await d.press(button('Select')); await d.press({ role: 'checkbox', name: /Team offsite in March/ }, 'Space'); },
    act: ({ page }) => page.keyboard.press('Escape'),
    target: button('Select'),
    check: async ({ page }) => { if ((await page.getByRole('checkbox').count()) > 0) throw new Error('selection mode is still on'); },
  },
  {
    screen: 'Inbox', action: 'Undo',
    setup: async (d) => { await inbox(d); await d.choose(more('Launch date: Tuesday or Thursday?'), 'Archive'); },
    act: (d) => d.press(button('Undo')),
    target: link(/Launch date: Tuesday or Thursday/),
    says: 'Restored 1 message.',
  },
  {
    // The app renders the restore a moment after the press, as one waiting on a server would. Focus waits on Undo.
    screen: 'Inbox', action: 'Undo that renders later',
    setup: async (d) => { await inboxLater(d); await d.choose(more('Launch date: Tuesday or Thursday?'), 'Archive'); },
    act: (d) => d.press(button('Undo')),
    done: ({ page }) => page.getByRole('button', { name: 'Undo' }).waitFor({ state: 'detached' }),
    target: link(/Launch date: Tuesday or Thursday/),
  },
  {
    // While Undo waits, the person moves on, and focus stays where they put it.
    screen: 'Inbox', action: 'Undo that renders later, focus moved meanwhile',
    setup: async (d) => { await inboxLater(d); await d.choose(more('Launch date: Tuesday or Thursday?'), 'Archive'); },
    act: async (d) => {
      await d.press(button('Undo'));
      await locate(d.page, link(/Team offsite in March/)).focus();
    },
    done: ({ page }) => page.getByRole('button', { name: 'Undo' }).waitFor({ state: 'detached' }),
    target: link(/Team offsite in March/),
  },
  {
    screen: 'Inbox', action: 'Escape on the open message',
    setup: async (d) => { await inbox(d); await d.press(link(/Launch date: Tuesday or Thursday/)); },
    act: ({ page }) => page.keyboard.press('Escape'),
    target: link(/Launch date: Tuesday or Thursday/), url: /\/app\/inbox$/,
  },
  {
    screen: 'Inbox', action: 'The open message’s back link', only: 'phone',
    setup: async (d) => { await inbox(d); await d.press(link(/Launch date: Tuesday or Thursday/)); },
    act: (d) => d.press(link('Inbox', article)),
    target: link(/Launch date: Tuesday or Thursday/), url: /\/app\/inbox$/,
  },
  {
    // A cold load has no entry before it to go back to, so this is InboxFlow's own return to the row, without the app's.
    screen: 'Inbox', action: 'The back link of a message opened by its URL', only: 'phone',
    setup: async ({ page }) => { await page.goto('/app/inbox/m2'); },
    act: (d) => d.press(link('Inbox', article)),
    target: link(/Launch date: Tuesday or Thursday/), url: /\/app\/inbox$/,
  },
  {
    screen: 'Inbox', action: 'Escape in a row menu',
    setup: async (d) => { await inbox(d); await d.press(more('Launch date: Tuesday or Thursday?')); },
    act: ({ page }) => page.keyboard.press('Escape'),
    target: more('Launch date: Tuesday or Thursday?'),
  },
  {
    screen: 'Inbox', action: 'Expand a thread message',
    setup: async ({ page }) => { await page.goto('/app/inbox/m6'); },
    act: (d) => d.press(button(/^Tomás Herrera.*Tue 8:30/)),
    target: button(/^Tomás Herrera.*Tue 8:30/),
  },

  // Work. Soonest due first: WI-1035, WI-1042, WI-1018, WI-1039, WI-1025 (whose archive always fails), …; row 21 is WI-1009.
  {
    screen: 'Work', action: 'Sort', setup: work,
    act: async (d) => {
      if (d.device === 'desktop') return d.press(button('Amount'));
      const sort = d.page.getByRole('combobox', { name: 'Sort' });
      await sort.focus();
      await sort.selectOption({ label: 'Amount, descending' });
    },
    done: ({ page }) => expect(page.locator('[data-row-id]').first()).not.toHaveAttribute('data-row-id', 'WI-1035'),
    target: { desktop: button('Amount'), phone: { role: 'combobox', name: 'Sort' } },
    url: /sort=-?amount/,
  },
  // Paging lands on the new page in the commit that renders its rows: the summary line for Next and Previous, the
  // first new row for Load more. `watchRows` records each frame from the end of setup, and `expectLandsWithRows` checks
  // focus arrived with the rows, not a frame before or after.
  {
    screen: 'Work', action: 'Next page',
    setup: async (d) => { await work(d); await watchRows(d.page, 'main', '.ld-dt-summary'); },
    act: (d) => d.press(button('Next')), inView: true,
    done: ({ page }) => expect(page.locator('[data-row-id]').first()).not.toHaveAttribute('data-row-id', 'WI-1035'),
    target: SUMMARY, url: /page=2/,
    check: async (d) => {
      await expectLandsWithRows(d.page);
      // After a key press the summary line shows the ring every focus target shows.
      if (d.device === 'desktop') expect(await ringOf(locate(d.page, SUMMARY)), 'the focused summary line shows a ring').toEqual({ visible: true, style: 'solid' });
    },
  },
  {
    // Page 1 is cached, so its rows arrive in the same render as the press.
    screen: 'Work', action: 'Previous page',
    setup: async (d) => {
      await work(d);
      await d.press(button('Next'));
      await expect(d.page.locator('[data-row-id]').first()).not.toHaveAttribute('data-row-id', 'WI-1035');
      await locate(d.page, button('Previous')).focus();
      await watchRows(d.page, 'main', '.ld-dt-summary');
    },
    act: (d) => d.press(button('Previous')), inView: true,
    done: ({ page }) => expect(page.locator('[data-row-id]').first()).toHaveAttribute('data-row-id', 'WI-1035'),
    target: SUMMARY, url: /\/app\/work$/,
    check: ({ page }) => expectLandsWithRows(page),
  },
  {
    // A screen reader's browse cursor moves focus with no key press. Focus that leaves Next while the page loads stays
    // where it went.
    screen: 'Work', action: 'Next page, then focus moves while it loads', setup: work,
    act: async (d) => {
      await d.press(button('Next'));
      await locate(d.page, h1('Work')).evaluate((el: HTMLElement) => el.focus());
    },
    done: ({ page }) => expect(page.locator('[data-row-id]').first()).not.toHaveAttribute('data-row-id', 'WI-1035'),
    target: h1('Work'),
  },
  {
    screen: 'Data table', action: 'Load more',
    setup: async ({ page }) => {
      await page.goto('/fixtures/data-table');
      await page.getByRole('region', { name: 'Cursor paging' }).locator('[data-row-id="i1"]').waitFor();
      await watchRows(page, '[aria-labelledby="fx-cursor"]', '[data-row-id="i2"]');
    },
    act: (d) => d.press(button('Load more', { role: 'region', name: 'Cursor paging' })),
    done: ({ page }) => page.getByRole('region', { name: 'Cursor paging' }).locator('[data-row-id="i2"]').waitFor(),
    target: { css: '[data-row-id="i2"]', in: { role: 'region', name: 'Cursor paging' }, label: 'the first new row', contains: true },
    check: ({ page }) => expectLandsWithRows(page),
  },
  {
    // The last page arrives without Load more, which leaves in the same commit: focus goes to the new row before a
    // frame can show it on <body>.
    screen: 'Data table', action: 'Load more, the last page',
    setup: async (d) => {
      const cursor = d.page.getByRole('region', { name: 'Cursor paging' });
      await d.page.goto('/fixtures/data-table');
      await cursor.locator('[data-row-id="i1"]').waitFor();
      await d.press(button('Load more', { role: 'region', name: 'Cursor paging' }));
      await cursor.locator('[data-row-id="i3"]').waitFor();
      await locate(d.page, button('Load more', { role: 'region', name: 'Cursor paging' })).focus();
      await watchRows(d.page, '[aria-labelledby="fx-cursor"]', '[data-row-id="i4"]');
    },
    act: (d) => d.press(button('Load more', { role: 'region', name: 'Cursor paging' })),
    done: ({ page }) => page.getByRole('region', { name: 'Cursor paging' }).getByRole('button', { name: /Load more|Loading/ }).waitFor({ state: 'detached' }),
    target: { css: '[data-row-id="i4"]', in: { role: 'region', name: 'Cursor paging' }, label: 'the first new row', contains: true },
    check: ({ page }) => expectLandsWithRows(page),
  },
  {
    screen: 'Data table', action: 'Load more in the server example',
    setup: async ({ page }) => {
      await page.goto('/blocks/data-table');
      await page.locator(SERVER).getByText(/^50 of /).waitFor();
      await watchRows(page, SERVER, '[data-row-id]:nth-child(51)');
    },
    act: (d) => d.press(button('Load more', { role: 'region', name: 'Server mode' })),
    done: ({ page }) => page.locator(`${SERVER} [data-row-id]:nth-child(51)`).waitFor(),
    target: { css: '[data-row-id]:nth-child(51) [data-row-link], [data-row-id]:nth-child(51) .ld-row-target', in: { role: 'region', name: 'Server mode' }, label: 'the first new row’s link' },
    check: ({ page }) => expectLandsWithRows(page),
  },
  {
    screen: 'Data table', action: 'Next page in client mode',
    setup: async ({ page }) => {
      await page.goto('/fixtures/data-table');
      await page.locator('[aria-labelledby="fx-client-pages"] [data-row-id="i0"]').waitFor();
      await watchRows(page, '[aria-labelledby="fx-client-pages"]', '.ld-dt-summary');
    },
    act: (d) => d.press(button('Next', { role: 'region', name: 'Client pages' })),
    target: { css: '.ld-dt-summary', in: { role: 'region', name: 'Client pages' }, label: 'the table summary line' },
    check: ({ page }) => expectLandsWithRows(page),
  },
  {
    screen: 'Data table', action: 'Load more in client mode',
    setup: async ({ page }) => {
      await page.goto('/fixtures/data-table');
      await page.locator('[aria-labelledby="fx-client-more"] [data-row-id="i0"]').waitFor();
      await watchRows(page, '[aria-labelledby="fx-client-more"]', '[data-row-id="i3"]');
    },
    act: (d) => d.press(button('Load more', { role: 'region', name: 'Client load more' })),
    target: { css: '[data-row-id="i3"] th', in: { role: 'region', name: 'Client load more' }, label: 'the first new row’s header' },
    check: async (d) => {
      await expectLandsWithRows(d.page);
      if (d.device === 'desktop') expect(await ringOf(locate(d.page, { css: '[data-row-id="i3"] th', in: { role: 'region', name: 'Client load more' }, label: '' })), 'the focused row header shows Lede’s ring').toEqual({ visible: true, style: 'solid' });
    },
  },
  {
    // Load more adds no rows and leaves: the summary line takes focus in the same commit, so none falls to <body>.
    screen: 'Data table', action: 'Load more that adds no rows',
    setup: async ({ page }) => {
      await page.goto('/fixtures/data-table');
      await page.locator('[aria-labelledby="fx-nothing-more"] [data-row-id="i0"]').waitFor();
    },
    act: (d) => d.press(button('Load more', { role: 'region', name: 'Nothing more' })),
    done: ({ page }) => page.getByRole('region', { name: 'Nothing more' }).getByRole('button', { name: 'Load more' }).waitFor({ state: 'detached' }),
    target: { css: '.ld-dt-summary', in: { role: 'region', name: 'Nothing more' }, label: 'the table summary line' },
  },
  // A row that leaves with focus hands it to the row that took its place, else the last row, else the summary line.
  {
    screen: 'Data table', action: 'Row ••• → Delete on the last row', setup: removalFixture,
    act: (d) => d.choose(button('More actions for 3', removal), 'Delete'),
    target: removalRow('n2', 'the row before'),
  },
  {
    screen: 'Data table', action: 'Row ••• → Delete on the only row',
    setup: async (d) => {
      await removalFixture(d);
      for (const n of [1, 2, 3]) {
        await d.page.getByRole('region', { name: 'Removal' }).getByRole('button', { name: `More actions for ${n}` }).click();
        await d.page.getByRole('menuitem', { name: 'Delete' }).click();
      }
    },
    act: (d) => d.choose(button('More actions for 0', removal), 'Delete'),
    target: { css: '.ld-dt-summary', in: removal, label: 'the table summary line' },
  },
  {
    // The bar leaves with the selection, a moment before the rows: focus waits on the first selected row, then moves on
    // to the row that took its place.
    screen: 'Data table', action: 'Bulk Delete, the bar leaving before its rows',
    setup: async (d) => {
      await removalFixture(d);
      await d.press({ role: 'checkbox', name: 'Select 1' }, 'Space');
    },
    act: (d) => d.press(button('Delete', { role: 'toolbar', name: /selected/ })),
    done: ({ page }) => page.getByRole('region', { name: 'Removal' }).locator('[data-row-id="n1"]').waitFor({ state: 'detached' }),
    target: removalRow('n2', 'the row that took the first one’s place'),
  },
  {
    screen: 'Work', action: 'Row ••• → Archive succeeds', setup: work,
    act: (d) => d.choose(more('WI-1042'), 'Archive'),
    done: ({ page }) => locate(page, row('WI-1042')).waitFor({ state: 'detached' }),
    target: row('WI-1018'),
    says: 'Archived WI-1042.',
  },
  {
    screen: 'Work', action: 'Archive fails', setup: work,
    act: (d) => d.choose(more('WI-1025'), 'Archive'),
    done: ({ page }) => page.getByRole('alert').filter({ hasText: 'Couldn’t archive WI-1025.' }).waitFor(),
    target: more('WI-1025'),
  },
  {
    // On a phone the h1 is out of view in about 1 run in 20 on a heavily loaded machine. §4 doesn't say in view,
    // so it isn't pinned.
    screen: 'Work', action: 'Dismiss a failure',
    setup: async (d) => { await work(d); await d.choose(more('WI-1025'), 'Archive'); await d.page.getByRole('alert').waitFor(); },
    act: (d) => d.press(button('Dismiss')),
    target: h1('Work'),
  },
  {
    screen: 'Work', action: 'Try again succeeds',
    setup: async (d) => { await work(d); await d.choose(more('WI-1026'), 'Archive'); await d.page.getByRole('alert').waitFor(); },
    act: (d) => d.press(button('Try again')),
    done: ({ page }) => page.getByRole('alert').waitFor({ state: 'detached' }),
    target: h1('Work'),
  },
  {
    screen: 'Work', action: 'Tick a row',
    setup: work,
    act: (d) => d.press({ role: 'checkbox', name: 'Select WI-1018' }, 'Space'),
    done: ({ page }) => expect(page.getByRole('checkbox', { name: 'Select WI-1018' })).toBeChecked(),
    target: { role: 'checkbox', name: 'Select WI-1018' },
  },
  {
    screen: 'Work', action: 'Bulk Archive',
    setup: async (d) => { await work(d); await d.press({ role: 'checkbox', name: 'Select WI-1018' }, 'Space'); },
    act: (d) => d.press(button('Archive', toolbar)),
    done: ({ page }) => locate(page, row('WI-1018')).waitFor({ state: 'detached' }),
    target: row('WI-1039'),
    says: 'Archived WI-1018.',
    // The bar leaves with the archived row, so focus moves once: from the bar's Archive to the row that took its place.
    check: async ({ page }) => {
      const rows = (await focusMoves(page)).map((m) => m.focus).filter((f) => f.startsWith('a '));
      expect(rows, 'focus lands on one row, never waiting on the archived one').toHaveLength(1);
    },
  },
  {
    // SelectionBar's own default: Done returns focus to the control it came into the bar from, here the row's checkbox.
    screen: 'Work', action: 'SelectionBar Done',
    setup: async (d) => { await work(d); await d.press({ role: 'checkbox', name: 'Select WI-1018' }, 'Space'); },
    act: (d) => d.press(button('Done', toolbar)),
    done: ({ page }) => locate(page, toolbar).waitFor({ state: 'detached' }),
    target: { role: 'checkbox', name: 'Select WI-1018' },
  },
  {
    // SelectionBar's own Escape, which is Done: Work's list is a top-level place, so nothing else backs out.
    screen: 'Work', action: 'Escape in the selection bar',
    setup: async (d) => { await work(d); await d.press({ role: 'checkbox', name: 'Select WI-1018' }, 'Space'); },
    act: async ({ page }) => {
      await locate(page, button('Archive', toolbar)).focus();
      await page.keyboard.press('Escape');
    },
    target: { role: 'checkbox', name: 'Select WI-1018' }, url: /\/app\/work$/,
    check: async ({ page }) => { await expect(locate(page, toolbar)).toHaveCount(0); },
  },
  {
    // The bar stays with the row that failed, so the archive has ended: Escape returns focus to where it came from.
    screen: 'Work', action: 'Escape after a bulk archive that failed',
    setup: async (d) => {
      await work(d);
      await d.press({ role: 'checkbox', name: 'Select WI-1025' }, 'Space');
      await d.press(button('Archive', toolbar));
      await d.page.getByRole('alert').filter({ hasText: 'Couldn’t archive WI-1025.' }).waitFor();
    },
    act: async ({ page }) => {
      await locate(page, button('Archive', toolbar)).focus();
      await page.keyboard.press('Escape');
    },
    done: ({ page }) => locate(page, toolbar).waitFor({ state: 'detached' }),
    target: { role: 'checkbox', name: 'Select WI-1025' },
  },
  {
    // A screen reader's browse cursor can leave the heading while the rows load; focus stays where it went.
    screen: 'Work', action: 'Focus moved while the rows load after Archive on the item page',
    setup: async (d) => { await work(d); await d.press(row('WI-1039')); await d.page.waitForURL('**/app/work/WI-1039'); },
    act: async (d) => {
      await d.press(button('Archive', main));
      await d.page.waitForURL('**/app/work');
      await expect(locate(d.page, h1('Work'))).toBeFocused();
      await locate(d.page, link('Today', appNav)).evaluate((el: HTMLElement) => el.focus());
    },
    done: ({ page }) => locate(page, row('WI-1025')).waitFor(),
    target: link('Today', appNav), url: /\/app\/work$/,
  },
  {
    screen: 'Work', action: 'Archive on the item page',
    setup: async (d) => { await work(d); await d.press(row('WI-1039')); await d.page.waitForURL('**/app/work/WI-1039'); },
    act: (d) => d.press(button('Archive', main)),
    done: ({ page }) => page.waitForURL('**/app/work'),
    target: row('WI-1025'), url: /\/app\/work$/,
    says: 'Archived WI-1039.',
  },
  {
    // The item archived from its own page is handed on once: a later sort, with focus back on the heading, leaves it there.
    screen: 'Work', action: 'Sort with focus on the heading after Archive on the item page', only: 'desktop',
    setup: async (d) => {
      await work(d);
      await d.press(row('WI-1039'));
      await d.page.waitForURL('**/app/work/WI-1039');
      await d.press(button('Archive', main));
      await d.page.waitForURL('**/app/work');
      await expect(locate(d.page, row('WI-1025'))).toBeFocused();
      await locate(d.page, h1('Work')).focus();
    },
    act: async ({ page }) => {
      await page.getByRole('button', { name: 'Title', exact: true }).evaluate((b: HTMLElement) => b.click());
      await expect(page).toHaveURL(/sort=title/);
      await page.locator('main .ld-dt-summary').filter({ hasNotText: 'Updating' }).waitFor();
    },
    target: h1('Work'), url: /sort=title/,
  },
  {
    screen: 'Work', action: 'Escape on an item',
    setup: async (d) => { await work(d); await d.press(row('WI-1039')); await d.page.waitForURL('**/app/work/WI-1039'); },
    act: ({ page }) => page.keyboard.press('Escape'),
    target: row('WI-1039'), url: /\/app\/work$/, inView: true,
  },
  {
    screen: 'Work', action: 'The item’s back link',
    setup: async (d) => { await work(d); await d.press(row('WI-1039')); await d.page.waitForURL('**/app/work/WI-1039'); },
    act: (d) => d.press(link('Work', main)),
    done: ({ page }) => locate(page, row('WI-1039')).waitFor(),
    target: row('WI-1039'), url: /\/app\/work$/, inView: true,
  },
  {
    screen: 'Work', action: 'Back from an item opened low in the list',
    setup: async (d) => {
      await work(d);
      const item = locate(d.page, row('WI-1009')).first();
      await item.scrollIntoViewIfNeeded();
      await d.press(item);
      await d.page.waitForURL('**/app/work/WI-1009');
    },
    act: async ({ page }) => { await page.goBack(); },
    done: ({ page }) => locate(page, row('WI-1009')).waitFor(),
    target: row('WI-1009'), url: /\/app\/work$/, inView: true,
  },

  {
    // Back between two of Work's entries swaps the rows on the same screen. The row that had focus leaves with its page,
    // which isn't a removal, so the return lands where the person was on that page.
    screen: 'Work', action: 'Back to another page of Work with focus in a row',
    setup: async (d) => {
      await d.page.goto('/app/work?page=2');
      await locate(d.page, row('WI-1053')).focus();
      await d.press(link('Work', appNav));
      await d.page.waitForURL(/\/app\/work$/);
      await locate(d.page, row('WI-1039')).focus();
    },
    act: async ({ page }) => { await page.goBack(); },
    done: ({ page }) => locate(page, row('WI-1053')).waitFor(),
    target: row('WI-1053'), url: /\/app\/work\?page=2$/,
  },
  {
    // A screen reader's browse cursor moves focus with no key or pointer event, so a script's focus() stands in for it.
    screen: 'Work', action: 'Focus moved while the rows load',
    setup: async (d) => { await work(d); await d.press(row('WI-1039')); await d.page.waitForURL('**/app/work/WI-1039'); },
    act: async ({ page }) => {
      await page.goBack();
      await expect(locate(page, h1('Work'))).toBeFocused();
      await locate(page, link('Today', appNav)).evaluate((el: HTMLElement) => el.focus());
    },
    done: ({ page }) => locate(page, row('WI-1039')).waitFor(),
    target: link('Today', appNav), url: /\/app\/work$/,
  },
  // Each server example restores its own rows, so each has a row of its own.
  ...([['Server mode', 'dt-server'], ['Search and filters', 'dt-search']] as const).map(([region, id]): Action => {
    const item = link(/\bWI-1001\b/, { role: 'region', name: region });
    return {
      screen: 'Data table', action: `Back to a row in ${region}`,
      setup: async (d) => {
        await d.page.goto(`/blocks/data-table#${id}`);
        const first = locate(d.page, item).first();
        await first.waitFor();
        await d.press(first);
        await d.page.waitForURL(`**/blocks/data-table/items/WI-1001?from=${id}`);
      },
      act: async ({ page }) => { await page.goBack(); },
      done: ({ page }) => locate(page, item).first().waitFor(),
      target: item, url: new RegExp(`/blocks/data-table#${id}$`), inView: true,
    };
  }),

  // Settings, Appearance, Profile.
  {
    screen: 'Settings', action: 'Toggle a switch', setup: async ({ page }) => { await page.goto('/app/settings'); },
    act: (d) => d.press({ role: 'switch', name: 'Daily brief' }, 'Space'),
    target: { role: 'switch', name: 'Daily brief' },
  },
  ...(['Appearance', 'Profile'] as const).flatMap((screen): Action[] => {
    const opener = screen === 'Appearance' ? link(/^Appearance/) : link(/^Hana Sato/, main);
    const open = async (d: Driver) => { await d.page.goto('/app/settings'); await d.press(opener); await d.page.waitForURL(/appearance|profile/); };
    return [
      {
        screen, action: 'Its back link', setup: open,
        act: (d) => d.press(link('Settings', main)),
        target: opener, url: /\/app\/settings$/,
      },
      {
        screen, action: 'Escape', setup: open,
        act: ({ page }) => page.keyboard.press('Escape'),
        target: opener, url: /\/app\/settings$/,
      },
    ];
  }),
  {
    screen: 'Appearance', action: 'Change Mode', setup: async ({ page }) => { await page.goto('/app/settings/appearance'); },
    act: async (d) => {
      if (d.device === 'phone') return d.press(radio('Light'));
      await locate(d.page, radio('Automatic')).focus();
      await d.page.keyboard.press('ArrowRight');
    },
    target: radio('Light'),
  },
  {
    screen: 'Profile', action: 'Edit profile', setup: async ({ page }) => { await page.goto('/app/profile'); },
    act: (d) => d.press(button('Edit profile')),
    target: field('Name'),
    check: async ({ page }) => {
      const hint = await page.getByRole('textbox', { name: 'Name', exact: true }).getAttribute('enterkeyhint');
      if (hint !== 'done') throw new Error(`Name’s enterkeyhint is ${hint}, not done`);
    },
  },
  {
    screen: 'Profile', action: 'Save by Enter',
    setup: async (d) => { await d.page.goto('/app/profile'); await d.press(button('Edit profile')); },
    act: ({ page }) => page.keyboard.press('Enter'),
    done: ({ page }) => page.getByRole('status').filter({ hasText: 'Profile saved' }).waitFor(),
    target: button('Edit profile'),
    says: 'Profile saved',
  },
  {
    screen: 'Profile', action: 'Cancel',
    setup: async (d) => { await d.page.goto('/app/profile'); await d.press(button('Edit profile')); },
    act: (d) => d.press(button('Cancel')),
    target: button('Edit profile'),
  },
  {
    screen: 'Profile', action: 'Save with errors',
    setup: async (d) => { await d.page.goto('/app/profile'); await d.press(button('Edit profile')); await d.page.getByRole('textbox', { name: 'Name', exact: true }).fill(''); },
    act: (d) => d.press(button('Save changes')),
    target: field('Name'),
  },
  {
    screen: 'Profile', action: 'Escape while editing, nothing changed',
    setup: async (d) => { await d.page.goto('/app/profile'); await d.press(button('Edit profile')); },
    act: ({ page }) => page.keyboard.press('Escape'),
    target: button('Edit profile'),
  },

  // Onboarding. Replay onboarding and the browser's Back out of it are the arrival table's /app/welcome row.
  {
    screen: 'Onboarding', action: 'Continue on Account', setup: async ({ page }) => { await page.goto('/app/welcome'); },
    act: (d) => d.press(button('Continue')),
    target: radio('Blue'), url: /\/preferences$/,
  },
  {
    screen: 'Onboarding', action: 'Continue on Preferences', setup: async ({ page }) => { await onboardTo(1)(page); },
    act: (d) => d.press(button('Continue')),
    target: button('Finish'), url: /\/review$/,
  },
  {
    screen: 'Onboarding', action: 'Finish', setup: async ({ page }) => { await onboardTo(2)(page); },
    act: (d) => d.press(button('Finish')),
    done: ({ page }) => page.waitForURL('**/app/welcome/done'),
    target: link('Get started'), url: /\/done$/,
  },
  {
    screen: 'Onboarding', action: 'The flow’s Back', setup: async ({ page }) => { await onboardTo(1)(page); },
    act: (d) => d.press(button('Back')),
    target: { desktop: field('Name'), phone: h1('Create your account') }, url: /\/app\/welcome$/,
  },
  {
    screen: 'Onboarding', action: 'A Review row', setup: async ({ page }) => { await onboardTo(2)(page); },
    act: (d) => d.press(button(/^Email/)),
    target: field('Email'), url: /\/app\/welcome$/,
  },
  {
    screen: 'Onboarding', action: 'Continue with errors',
    setup: async ({ page }) => { await page.goto('/app/welcome'); await page.getByRole('textbox', { name: 'Name', exact: true }).fill(''); },
    act: (d) => d.press(button('Continue')),
    target: field('Name'),
  },
  {
    screen: 'Onboarding', action: 'Continue with a bad email',
    setup: async ({ page }) => { await page.goto('/app/welcome'); await page.getByRole('textbox', { name: 'Email', exact: true }).fill('ada@'); },
    act: (d) => d.press(button('Continue')),
    target: field('Email'),
  },
  {
    screen: 'Onboarding', action: 'Cancel',
    setup: async (d) => { await d.page.goto('/app/settings'); await d.press(link('Replay onboarding')); await d.page.waitForURL('**/app/welcome'); },
    act: (d) => d.press(link('Cancel')),
    target: link('Replay onboarding'), url: /\/app\/settings$/,
  },
  {
    screen: 'Onboarding', action: 'Finish while offline',
    setup: async ({ page }) => { await onboardTo(2)(page); await page.context().setOffline(true); },
    act: (d) => d.press(button('Finish')),
    done: ({ page }) => page.getByRole('alert').filter({ hasText: 'offline' }).waitFor(),
    target: button('Finish'),
  },

  // Everywhere. A nav link to another place is the arrival table's `via` column.
  {
    screen: 'Everywhere', action: 'Skip link, then Tab', setup: async ({ page }) => { await page.goto('/app/inbox'); },
    act: async ({ page }) => {
      await page.locator('a.ld-skip').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('main')).toBeFocused();
      await page.keyboard.press('Tab');
    },
    target: button('Select'),
  },
  {
    screen: 'Everywhere', action: 'In-page hash link', setup: async ({ page }) => { await page.goto('/layouts/sidebar'); },
    act: (d) => d.press(link('Projects', { role: 'navigation', name: 'Workspace' })),
    target: { role: 'region', name: 'Projects' }, url: /#projects$/,
  },
  {
    screen: 'Everywhere', action: 'In-page hash link to the top', setup: async ({ page }) => { await page.goto('/layouts/sidebar#people'); },
    act: (d) => d.press(link('Overview', { role: 'navigation', name: 'Workspace' })),
    target: { role: 'region', name: 'Overview' }, url: /#overview$/,
  },
  {
    // The button that shows the next screen stays focused inside <main> as its PageHeader mounts. Only a move made in
    // that commit keeps focus from the heading, and this one was made before it.
    screen: 'Everywhere', action: 'A new screen under a control that keeps focus',
    setup: async ({ page }) => { await page.goto('/fixtures/page-header'); },
    act: (d) => d.press(button('Show the next screen')),
    target: h1('Screen 2'),
  },
  {
    screen: 'Everywhere', action: 'Disclosure toggle', setup: async ({ page }) => { await page.goto('/app'); },
    act: (d) => d.press(button(/^Meetings/)),
    target: button(/^Meetings/),
  },
  {
    screen: 'Data table', action: 'Layout switch, table to cards', only: 'desktop',
    setup: async (d) => { await work(d); await locate(d.page, row('WI-1018')).focus(); },
    act: ({ page }) => page.setViewportSize({ width: 480, height: 800 }),
    done: ({ page }) => page.getByRole('list', { name: 'Work items' }).waitFor(),
    target: row('WI-1018'),
  },
  {
    // The tick's checkbox leaves with the table, and the card's own takes its place: Done has no origin to go back to.
    screen: 'Work', action: 'SelectionBar Done after the table becomes cards', only: 'desktop',
    setup: async (d) => {
      await work(d);
      await d.press({ role: 'checkbox', name: 'Select WI-1018' }, 'Space');
      await locate(d.page, button('Done', toolbar)).focus();
      await d.page.setViewportSize({ width: 400, height: 800 });
      await d.page.getByRole('list', { name: 'Work items' }).waitFor();
    },
    act: ({ page }) => page.keyboard.press('Enter'),
    done: ({ page }) => locate(page, toolbar).waitFor({ state: 'detached' }),
    target: SUMMARY,
  },
  ...([
    ['Refresh after a failed reload', 'Reload', 'Refresh'],
    ['Try again after a failed load', 'Assignee', 'Try again'],
  ] as const).map(([action, trigger, retry]): Action => ({
    screen: 'Data table', action,
    // A reload that fails keeps the saved rows and offers Refresh; a new sort that fails hides them and offers Try again.
    setup: async ({ page }) => {
      await page.goto('/blocks/data-table#dt-server');
      const server = page.getByRole('region', { name: 'Server mode' });
      await server.getByText(/^50 of/).waitFor();
      await server.getByRole('button', { name: 'Fail the next request' }).click();
      await server.getByRole('button', { name: trigger }).click();
      await server.getByRole('button', { name: retry }).waitFor();
      // The summary isn't a live region, so what it says as focus arrives is what a screen reader reads.
      await server.locator('.ld-dt-summary').evaluate((el) => el.addEventListener('focus', () => { el.setAttribute('data-text-at-focus', el.textContent ?? ''); }, { once: true }));
    },
    act: (d) => d.press(button(retry, { role: 'region', name: 'Server mode' })),
    done: ({ page }) => page.getByRole('region', { name: 'Server mode' }).getByRole('button', { name: retry }).waitFor({ state: 'detached' }),
    target: { css: '.ld-dt-summary', in: { role: 'region', name: 'Server mode' }, label: 'the table summary line' },
    check: async ({ page }) => {
      const summary = page.getByRole('region', { name: 'Server mode' }).locator('.ld-dt-summary');
      await expect(summary, 'the summary has its text when focus arrives').toHaveAttribute('data-text-at-focus', /\S/);
    },
  })),

  // ListRow keeps the reader's place when a row action removes its row and the parent moves no focus, as the docs
  // sample's Delete does. Its fixture removes rows with a plain state update.
  ...([
    ['the middle row', 'Work phone', link(/^Tablet/)],
    ['the last row', 'Tablet', link(/^Work phone/)],
  ] as const).flatMap(([where, name, target]): Action[] => [
    { screen: 'List', action: `Row ••• → Delete on ${where}`, setup: listFocus, act: (d) => d.choose(more(name), 'Delete'), target },
    { screen: 'List', action: `Swipe → Delete on ${where}`, setup: listFocus, only: 'phone', strictTouch: true, act: (d) => swipeTo(d, name, 'Delete'), target },
  ]),
  {
    screen: 'List', action: 'Row ••• → Delete on a group’s only row', setup: listFocus,
    act: (d) => d.choose(more('Desk computer'), 'Delete'), target: h2('Last device'),
  },
  {
    screen: 'List', action: 'Row ••• → End on an untitled group’s only row', setup: listFocus,
    act: (d) => d.choose(more('Guest session'), 'End'), target: button('After the list'),
  },
  {
    // The row stays, so the swipe actions close and their button goes inert: focus moves to the row's link first.
    screen: 'List', action: 'Swipe → Mark read, the row stays', setup: listFocus, only: 'phone', strictTouch: true,
    act: (d) => swipeTo(d, 'Weekly summary', 'Mark read'), target: link(/^Weekly summary/),
    check: async ({ page }) => { await expect(locate(page, link(/^Weekly summary/))).toContainText('Read'); },
  },

  // MasterDetail moves focus when its panes swap, for a caller with no focus code. Stacked under 1100px.
  {
    screen: 'Master detail', action: 'Open an item from its row', setup: masterDetail, viewport: stackedView,
    act: (d) => d.press(button(/^Team offsite/)), target: h2('Team offsite'),
  },
  {
    screen: 'Master detail', action: 'Close an item', viewport: stackedView,
    setup: async (d) => { await masterDetail(d); await d.press(button(/^Team offsite/)); await locate(d.page, h2('Team offsite')).waitFor(); },
    act: (d) => d.press(button('Close')), target: button(/^Team offsite/),
  },
];

// ——— How a row becomes tests ———

const DEVICES: Device[] = ['desktop', 'phone'];
const RUN = process.env.FOCUS_PENDING;
const runs = (reason: Pending) => RUN === 'all' || (!!RUN && reason.includes(RUN));

/**
 * Declares one test that checks every part of a row that holds today, and one per pending reason that checks the parts
 * it names. A pending test is `test.fixme` with that reason, unless `FOCUS_PENDING` asks for it.
 */
export function rowTests<P extends string>(
  title: string,
  parts: readonly P[],
  pending: Partial<Record<P, Each<Pending | undefined>>> = {},
  only: Device | undefined,
  run: (page: Page, device: Device, check: Set<P>) => Promise<void>,
  { strictTouch = false }: { strictTouch?: boolean } = {},
) {
  const devices = DEVICES.filter((d) => !only || only === d);
  const reason = (part: P, device: Device) => (pending[part] === undefined ? undefined : each(pending[part]!, device));
  const deviceOf = (isMobile: boolean): Device => (isMobile ? 'phone' : 'desktop');

  const holding = (device: Device) => parts.filter((part) => !reason(part, device));
  if (devices.some((d) => holding(d).length > 0)) {
    test(title, async ({ page, isMobile }) => {
      const device = deviceOf(isMobile);
      test.skip(!devices.includes(device), `This row runs on ${only} only.`);
      test.skip(holding(device).length === 0, `On ${device} every part is pending.`);
      await run(page, device, new Set(holding(device)));
    });
  }

  if (strictTouch && holding('phone').length > 0) {
    test.describe(() => {
      // The phone's own viewport and touch, so the swipe runs on the single-pane layout the phone project sees.
      const { defaultBrowserType: _, ...phone } = browsers['Pixel 7'];
      test.use(phone);
      test(`${title} · by touch under StrictMode`, async ({ page }, info) => {
        test.skip(info.project.name !== 'strict-desktop', 'The phone project runs it by touch without StrictMode.');
        await run(page, 'phone', new Set(holding('phone')));
      });
    });
  }

  for (const why of new Set(devices.flatMap((d) => parts.map((part) => reason(part, d))).filter((r) => r !== undefined))) {
    const named = (device: Device) => parts.filter((part) => reason(part, device) === why);
    const where = devices.filter((d) => named(d).length > 0);
    const scope = where.length < DEVICES.length ? ` (${where.join(', ')})` : '';
    test(`${title} · ${named(where[0]).join(', ')}${scope} · ${why}`, async ({ page, isMobile }) => {
      const device = deviceOf(isMobile);
      test.skip(!where.includes(device), `On ${device} this holds today, and “${title}” checks it.`);
      test.fixme(!runs(why), why);
      await run(page, device, new Set(named(device)));
    });
  }
}
