import { renderToString } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { JSONUIProvider, Renderer, type ComponentRenderer } from '@json-render/react';
import { SpecView } from '@/components/lede/json-render/spec-view';
import { catalog } from '@/components/lede/json-render/catalog';
import { registry } from '@/components/lede/json-render/registry';
import { check } from '@/components/lede/json-render/check';
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

test('the registry draws every catalog entry', () => {
  expect(Object.keys(registry).sort()).toEqual(Object.keys(catalog.data.components).sort());
});

test('the invalid spec shows each kind of mistake the page explains', () => {
  expect(Object.values(invalid.elements).map((e) => e.type).filter((type) => !(type in registry))).toEqual(['Carousel']);
  expect(check(invalid)).toEqual([
    expect.stringMatching(/^elements\.gallery\.type: Invalid option/),
    'screen: Element "screen" references child "missing" which does not exist in the elements map.',
    expect.stringMatching(/^elements\.save\.props\.variant: Invalid option/),
    expect.stringMatching(/^elements\.period\.props\.options: Invalid input: expected array, received number$/),
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
      row: { type: 'ListRow', props: { title: { $item: 'title' }, chevron: true }, on: { press: { action: 'open', params: { id: { $template: '${id}' } } } }, children: [] },
    },
  } as unknown as (typeof specs)['Inbox'];
  expect(check(spec)).toEqual([]);
  const html = renderToString(<SpecView spec={spec} />);
  expect([...html.matchAll(/class="ld-row-title"[^>]*>([^<]*)</g)].map(([, t]) => t)).toEqual(['Venue review', 'Design critique']);
  expect(html.match(/<li\b/g)?.length).toBe(2);
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
