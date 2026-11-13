import { renderToString } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { JSONUIProvider, Renderer, type ComponentRenderer } from '@json-render/react';
import { SpecView, specStore } from '@/components/lede/json-render/spec-view';
import { catalog, functions, prompt, promptFixes, rules } from '@/components/lede/json-render/catalog';
import { registry } from '@/components/lede/json-render/registry';
import { check } from '@/components/lede/json-render/check';
import { fit } from '@/components/lede/json-render/catalog-fit';
import { specs } from '../src/specs';

const { 'Invalid spec': invalid, ...recorded } = specs;

/** Renders a spec on the server and returns the types json-render found no component for. */
function unrendered(spec: (typeof specs)[keyof typeof specs]) {
  const missing: string[] = [];
  const Missing: ComponentRenderer = ({ element }) => { missing.push(element.type); return null; };
  renderToString(
    <JSONUIProvider registry={registry} initialState={spec.state ?? {}}>
      <Renderer spec={spec} registry={registry} fallback={Missing} />
    </JSONUIProvider>,
  );
  return missing;
}

describe.each(Object.entries(recorded))('%s', (_, spec) => {
  test('every element type has a Lede component in the registry', () => {
    expect(unrendered(spec)).toEqual([]);
  });

  test('every element passes the catalog and its props pass their schema', () => {
    expect(check(spec)).toEqual([]);
  });
});

test('every catalog entry fits its Lede component, which this entry’s typecheck checks too', () => {
  expect(Object.values(fit).every((v) => v === true)).toBe(true);
});

test('the registry draws every catalog entry', () => {
  expect(Object.keys(registry).sort()).toEqual(Object.keys(catalog.data.components).sort());
});

test('the invalid spec shows each kind of mistake the page explains', () => {
  expect(Object.values(invalid.elements).map((e) => e.type).filter((type) => !(type in registry))).toEqual(['Carousel']);
  expect(check(invalid)).toEqual([
    expect.stringMatching(/^elements\.gallery\.type: Invalid option/),
    'screen: Element "screen" references child "missing" which does not exist in the elements map.',
    'elements.save.props: Unrecognized key: "icon"',
    expect.stringMatching(/^elements\.save\.props\.variant: Invalid option/),
    expect.stringMatching(/^elements\.period\.props\.options: Invalid input: expected array, received number$/),
  ]);
});

/** A screen of one element, `el`, keyed `x`, below a header. */
const one = (el: Record<string, unknown>, state: Record<string, unknown> = {}) => ({
  root: 'screen',
  state,
  elements: {
    screen: { type: 'Screen', props: {}, children: ['header', 'x'] },
    header: { type: 'PageHeader', props: { title: 'Check' }, children: [] },
    x: { children: [], ...el },
  },
}) as unknown as (typeof specs)['Inbox'];

test('a prop the catalog doesn’t have is an issue whatever its value, and the check never throws on one', () => {
  expect(check(one({ type: 'Button', props: { label: 'Save', typo: { $state: '/x' } } }))).toEqual(['elements.x.props: Unrecognized key: "typo"']);
  expect(check(one({ type: 'Button', props: { label: { $state: '/label' } } }))).toEqual([]);
});

test('the check reads each binding: its event, its action and that action’s params', () => {
  const button = (on: unknown) => one({ type: 'Button', props: { label: 'Go' }, on });
  expect(check(button({ press: { action: 'open', params: { id: 'm1' } } }))).toEqual([
    'elements.x.on.press.action: there is no action “open”. The actions are setState, pushState, removeState, validateForm, archive, submit.',
  ]);
  expect(check(button({ press: { action: 'archive', params: { ids: ['m1'] } } }))).toEqual([
    'elements.x.on.press.params: Unrecognized key: "ids"',
    'elements.x.on.press.params.id: Invalid input: expected string, received undefined',
  ]);
  expect(check(button({ press: [{ action: 'setState', params: { value: 1 } }, { action: 'archive', params: { id: { $template: '${id}' } } }] }))).toEqual([
    'elements.x.on.press.0.params.statePath: Invalid input: expected string, received undefined',
  ]);
  expect(check(button({ change: { action: 'setState', params: { statePath: '/x', value: 1 } } }))).toEqual([
    'elements.x.on.change: Button has no event “change”. Its events are press.',
  ]);
  expect(check(one({ type: 'TextField', props: { label: 'Name', value: { $bindState: '/name' } }, watch: { '/name': { action: 'lookup' } } }))).toEqual([
    'elements.x.watch./name.action: there is no action “lookup”. The actions are setState, pushState, removeState, validateForm, archive, submit.',
  ]);
});

test('the check names a $computed function or a slot the catalog doesn’t have', () => {
  expect(check(one({ type: 'SummaryCard', props: { title: 'Total', summary: { $computed: 'average', args: { items: { $state: '/bills' } } } } }))).toEqual([
    'elements.x: there is no function “average” for $computed. The functions are scale, remaining, sum.',
  ]);
  expect(check(one({ type: 'SummaryCard', props: { title: 'Total', summary: { $computed: 'sum', args: { items: { $state: '/bills' } } } } }))).toEqual([]);
  expect(check(one({ type: 'EmptyState', props: { title: 'Nothing yet' }, slots: { actions: [] } }))).toEqual([
    'elements.x.slots.actions: EmptyState has no slot “actions”.',
  ]);
});

describe.each([2, 3] as const)('under a level %i title', (level) => {
  const html = renderToString(<SpecView spec={specs.Inbox} headingLevel={level} />);
  const headings = [...html.matchAll(/<h(\d)[^>]*>(.*?)<\/h\1>/g)].map(([, n, text]) => `h${n} ${text.replace(/<[^>]+>/g, '')}`);

  test('the screen’s title takes that level and its sections the next', () => {
    expect(headings[0]).toBe(`h${level} Inbox`);
    expect(headings.slice(1).every((h) => h.startsWith(`h${level + 1} `))).toBe(true);
    expect(headings.length).toBeGreaterThan(1);
  });
});

test('a ListGroup that repeats over state draws one ListRow per item and passes the check', () => {
  const spec = {
    root: 'screen',
    state: { meetings: [{ id: 'a', title: 'Venue review' }, { id: 'b', title: 'Design critique' }] },
    elements: {
      screen: { type: 'Screen', props: {}, children: ['header', 'list'] },
      header: { type: 'PageHeader', props: { title: 'Your week' }, children: [] },
      list: { type: 'ListGroup', props: { title: 'Coming up' }, repeat: { statePath: '/meetings', key: 'id' }, children: ['row'] },
      row: { type: 'ListRow', props: { title: { $item: 'title' } }, children: [] },
    },
  } as unknown as (typeof specs)['Inbox'];
  expect(check(spec)).toEqual([]);
  const html = renderToString(<SpecView spec={spec} />);
  expect([...html.matchAll(/class="ld-row-title"[^>]*>([^<]*)</g)].map(([, t]) => t)).toEqual(['Venue review', 'Design critique']);
  expect(html.match(/<li\b/g)?.length).toBe(2);
});

test('a row’s chevron promises a View the spec holds, and a detail’s back is bound', () => {
  const spec = (press: unknown, back: unknown = { action: 'setState', params: { statePath: '/open', value: '' } }) => ({
    root: 'screen',
    state: { open: '' },
    elements: {
      screen: { type: 'Screen', props: {}, children: ['list', 'detail'] },
      list: { type: 'View', props: {}, visible: { $state: '/open', not: true }, children: ['header', 'rows'] },
      header: { type: 'PageHeader', props: { title: 'Inbox' }, children: [] },
      rows: { type: 'ListGroup', props: { title: 'Today' }, children: ['row', 'plain'] },
      row: { type: 'ListRow', props: { title: 'Grace Hopper' }, ...(press ? { on: { press } } : {}), children: [] },
      plain: { type: 'ListRow', props: { title: 'Alan Turing', chevron: true }, children: [] },
      detail: { type: 'View', props: {}, visible: { $state: '/open', eq: 'm1' }, children: ['detail-header'] },
      'detail-header': { type: 'PageHeader', props: { title: 'Grace Hopper', back: { label: 'Inbox' } }, ...(back ? { on: { back } } : {}), children: [] },
    },
  }) as unknown as (typeof specs)['Inbox'];
  const opens = { action: 'setState', params: { statePath: '/open', value: 'm1' } };
  expect(check(spec(opens))).toEqual([]);
  expect(check(spec({ action: 'archive', params: { id: 'm1' } }))).toEqual([expect.stringMatching(/^elements\.row\.on\.press: a row's press shows a chevron/)]);
  expect(check(spec({ action: 'setState', params: { statePath: '/picked', value: 'm1' } }))).toHaveLength(1);
  expect(check(spec(opens, null))).toEqual([expect.stringMatching(/^elements\.detail-header\.on\.back:/)]);
  // A chevron shows on the row whose press is bound, and on no other, whatever the spec asks.
  const html = renderToString(<SpecView spec={spec(opens)} />);
  expect(html.match(/ld-row-chevron/g)).toHaveLength(1);
  expect(renderToString(<SpecView spec={spec(null)} />)).not.toMatch(/ld-row-chevron/);
});

test('a SegmentedControl shows its label, which Lede’s own control keeps for screen readers', () => {
  const spec = {
    root: 'screen',
    state: { size: '4 people' },
    elements: {
      screen: { type: 'Screen', props: {}, children: ['size'] },
      size: { type: 'SegmentedControl', props: { label: 'Party size', options: ['2 people', '4 people'], value: { $bindState: '/size' } }, children: [] },
    },
  } as unknown as (typeof specs)['Inbox'];
  const html = renderToString(<SpecView spec={spec} />);
  expect(html).toMatch(/<p class="ld-field-label" aria-hidden="true">Party size<\/p>/);
  expect(html).toMatch(/<legend[^>]*>Party size<\/legend>/);
});

test('a value computed in a repeat follows the state it reads', () => {
  const at = (servings: string) => {
    const spec = { ...specs.Recipe, state: { ...specs.Recipe.state, servings } };
    const html = renderToString(<SpecView spec={spec} />);
    return [...html.matchAll(/class="ld-row-value"[^>]*>([^<]*)</g)].map(([, t]) => t);
  };
  expect(at('4 people')).toEqual(['6', '400 g', '2', '1.5 tsp']);
  expect(at('6 people')).toEqual(['9', '600 g', '3', '2.25 tsp']);
});

test('scale reads a number inside text, and shows the amount as it was when it has none', () => {
  expect(functions.scale({ amount: 1.5, unit: 'tsp', from: 4, to: '2 people' })).toBe('0.75 tsp');
  expect(functions.scale({ amount: 'a pinch', from: 4, to: 6 })).toBe('a pinch');
});

test('scale and remaining give a noun its plural, and remaining never goes below 0', () => {
  expect(functions.scale({ amount: '2 cups', from: 4, to: 2, unit: 'cup', units: 'cups' })).toBe('1 cup');
  expect(functions.scale({ amount: 1, from: 2, to: 3, unit: 'cup', units: 'cups' })).toBe('1.5 cups');
  expect(functions.remaining({ from: 120, take: 500, unit: 'dollar', units: 'dollars' })).toBe('0 dollars');
  expect(functions.remaining({ from: 120, take: '', unit: 'dollar', units: 'dollars' })).toBe('120 dollars');
});

test('sum adds a field across a list, keeps only the items its where and unless allow, and never goes below 0', () => {
  const bills = [{ amount: 120, paid: true }, { amount: '80.50', paid: false }, { amount: 40 }, { amount: 'n/a' }];
  expect(functions.sum({ items: bills, field: 'amount', unit: 'dollar', units: 'dollars' })).toBe('240.5 dollars');
  expect(functions.sum({ items: bills, field: 'amount', unless: 'paid', unit: 'dollar', units: 'dollars' })).toBe('120.5 dollars');
  expect(functions.sum({ items: bills, field: 'amount', where: 'paid' })).toBe('120');
  expect(functions.sum({ items: [{ amount: 30 }, { amount: -50 }], field: 'amount' })).toBe('0');
  expect(functions.sum({ items: undefined, field: 'amount', unit: 'dollar', units: 'dollars' })).toBe('0 dollars');
});

test('a date field passes the catalog and draws the browser’s own date input, required', () => {
  const spec = {
    root: 'screen',
    state: { renews: '' },
    elements: {
      screen: { type: 'Screen', props: {}, children: ['header', 'renews'] },
      header: { type: 'PageHeader', props: { title: 'Policy' }, children: [] },
      renews: { type: 'TextField', props: { label: 'Renewal date', type: 'date', required: true, error: 'Enter the renewal date.', value: { $bindState: '/renews' } }, children: [] },
    },
  } as unknown as (typeof specs)['Inbox'];
  expect(check(spec)).toEqual([]);
  expect(renderToString(<SpecView spec={spec} />)).toMatch(/<input[^>]*type="date"[^>]*required=""|<input[^>]*required=""[^>]*type="date"/);
});

test('the prompt names only this catalog’s components and actions in its examples', () => {
  const raw = catalog.prompt({ mode: 'inline', customRules: rules });
  for (const [from] of promptFixes) expect(raw, `json-render's prompt no longer has: ${from}`).toContain(from);
  const text = prompt();
  for (const name of ['"Card"', '"Select"', 'loadCities', '"type":"Screen","props":{},"repeat"', '"type":"Screen","props":{},"on"']) expect(text).not.toContain(name);
  expect(text).toContain('its binding is an array');
});

test('a required SegmentedControl starts with no choice and no error, which waits for a check to hold an action back', () => {
  const spec = {
    root: 'screen',
    state: { priority: '' },
    elements: {
      screen: { type: 'Screen', props: {}, children: ['priority'] },
      priority: { type: 'SegmentedControl', props: { label: 'Priority', options: ['Low', 'High'], required: true, error: 'Choose a priority.', value: { $bindState: '/priority' } }, children: [] },
    },
  } as unknown as (typeof specs)['Inbox'];
  const html = renderToString(<SpecView spec={spec} />);
  expect(html).not.toContain('aria-describedby');
  expect(html).not.toContain('Choose a priority.');
  expect(html.match(/<input[^>]*required=""/g)?.length).toBe(2);
  expect(html).toMatch(/class="ld-seg-thumb"[^>]*hidden=""/);
});

describe('the state of a screen that streams', () => {
  test('a value the person sets keeps their change when the stream later sends that key', () => {
    const { store, sync } = specStore({});
    sync({ tasks: [] });
    store.set('/draft/priority', 'High');
    sync({ tasks: [{ id: 'a' }], draft: { title: '', priority: '' } });
    expect(store.get('/draft/priority')).toBe('High');
    expect(store.get('/draft/title')).toBe('');
    expect(store.get('/tasks')).toEqual([{ id: 'a' }]);
  });

  test('a row the person switches on while the list streams keeps its switch, and every later row still arrives', () => {
    const { store, sync } = specStore({});
    sync({ tasks: [{ id: 'a', done: false }] });
    store.set('/tasks/0/done', true);
    sync({ tasks: [{ id: 'a', done: false }, { id: 'b', done: false }] });
    sync({ tasks: [{ id: 'a', done: false }, { id: 'b', done: false }, { id: 'c', done: false }] });
    expect(store.get('/tasks')).toEqual([{ id: 'a', done: true }, { id: 'b', done: false }, { id: 'c', done: false }]);
  });

  test('a value the person sets whole stays theirs below it too', () => {
    const { store, sync } = specStore({});
    store.set('/draft', { title: 'x' });
    sync({ draft: { title: '' } });
    expect(store.get('/draft/title')).toBe('x');
  });

  test('a list the person adds to stays theirs, and the same state built again writes nothing', () => {
    const { store, sync } = specStore({ tasks: [{ id: 'a' }] });
    store.set('/tasks', [{ id: 'a' }, { id: 'mine' }]);
    sync({ tasks: [{ id: 'a' }, { id: 'b' }] });
    expect(store.get('/tasks')).toEqual([{ id: 'a' }, { id: 'mine' }]);
    sync(structuredClone({ tasks: [{ id: 'a' }, { id: 'b' }], done: {}, page: 1 }));
    const before = store.getSnapshot();
    sync(structuredClone({ tasks: [{ id: 'a' }, { id: 'b' }], done: {}, page: 1 }));
    expect(store.getSnapshot()).toBe(before);
    expect(store.get('/done')).toEqual({});
  });
});
