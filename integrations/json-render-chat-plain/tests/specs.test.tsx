import { renderToString } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { JSONUIProvider, Renderer, type ComponentRenderer } from '@json-render/react';
import type { Spec } from '@json-render/core';
import { catalog } from '../src/screens/catalog';
import { registry } from '../src/screens/registry';
import { check } from '../src/screens/check';
import { script } from '../src/chat/mock-transport';

const specs = script.flatMap(({ match, reply }) => (reply.spec ? [[String(match), reply.spec] as const] : []));

/** Renders a spec on the server and returns the types json-render found no component for. */
function unrendered(spec: Spec) {
  const missing: string[] = [];
  const Missing: ComponentRenderer = ({ element }) => { missing.push(element.type); return null; };
  renderToString(
    <JSONUIProvider registry={registry} initialState={spec.state ?? {}}>
      <Renderer spec={spec} registry={registry} fallback={Missing} />
    </JSONUIProvider>,
  );
  return missing;
}

describe.each(specs)('%s', (_, spec) => {
  test('every element type has a component in the registry, and every prop passes its schema', () => {
    expect(unrendered(spec)).toEqual([]);
    expect(check(spec)).toEqual([]);
  });
});

test('the registry draws every catalog entry', () => {
  expect(Object.keys(registry).sort()).toEqual(Object.keys(catalog.data.components).sort());
});

test('the check rejects a prop the catalog doesn’t have and a value outside a prop’s schema', () => {
  const settings = specs.find(([match]) => match.includes('notification'))![1];
  const wrong = structuredClone(settings);
  wrong.elements.title.props = { ...wrong.elements.title.props, level: 'h7' };
  wrong.elements['signature-text'].props = { ...wrong.elements['signature-text'].props, hint: 'Shown under the field.' };
  expect(check(wrong)).toEqual([
    expect.stringMatching(/^elements\.title\.props\.level: Invalid option/),
    expect.stringMatching(/^elements\.signature-text\.props: Unrecognized key: "hint"/),
  ]);
});
