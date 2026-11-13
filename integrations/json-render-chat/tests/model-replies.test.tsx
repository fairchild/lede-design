import { readdirSync, readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { evaluateVisibility, pipeJsonRender, type Spec } from '@json-render/core';
import type { UIMessageChunk } from 'ai';
import { check } from '@/components/lede/json-render/check';
import { specFromParts } from '@/components/lede/json-render/patches';
import { SpecView } from '@/components/lede/json-render/spec-view';

const DIR = new URL('./model-replies/', import.meta.url);
const replies = ['before', 'after'].flatMap((set) =>
  readdirSync(new URL(`${set}/`, DIR)).map((file) => [`${set}/${file}`, readFileSync(new URL(`${set}/${file}`, DIR), 'utf8')] as const));

/**
 * These replies were recorded before the catalog could open an item in place, and some bind an `open` action the
 * catalog no longer has. The check names each one, and a row's press that opens nothing, and nothing else.
 */
const opens = (key: string, row = false) => [
  `elements.${key}.on.press.action: there is no action “open”. The actions are setState, pushState, removeState, validateForm, archive, submit.`,
  ...(row ? [`elements.${key}.on.press: a row's press shows a chevron, so it opens a View: set the path a View's visible reads, or leave press out`] : []),
];
const issues: Record<string, string[]> = {
  '1-inbox.txt': [...opens('compose'), ...opens('message', true)],
  '5-laptops.txt': opens('laptop', true),
  '7-tasks.txt': opens('add'),
};

/** A model's text as the server streams it: in chunks of a few characters, through json-render's transform. */
async function stream(text: string) {
  const pieces = text.match(/[\s\S]{1,24}/g) ?? [];
  const model = new ReadableStream<UIMessageChunk>({
    start(controller) {
      controller.enqueue({ type: 'start' });
      controller.enqueue({ type: 'text-start', id: '1' });
      for (const delta of pieces) controller.enqueue({ type: 'text-delta', id: '1', delta });
      controller.enqueue({ type: 'text-end', id: '1' });
      controller.enqueue({ type: 'finish', finishReason: 'stop' });
      controller.close();
    },
  });
  const chunks: UIMessageChunk[] = [];
  for (const reader = pipeJsonRender(model).getReader(); ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

/** What a spec shows on its first render, read from the spec: each PageHeader's title, the rows and the Buttons' labels. */
function expected(spec: Spec) {
  const shown = { titles: [] as string[], rows: 0, buttons: [] as string[] };
  const state = spec.state ?? {};
  const walk = (key: string, item?: { repeatItem: unknown; repeatIndex: number }) => {
    const el = spec.elements[key];
    if (!el || (el.visible !== undefined && !evaluateVisibility(el.visible, { stateModel: state, ...item }))) return;
    const props = el.props as Record<string, unknown>;
    if (el.type === 'PageHeader') shown.titles.push(String(props.title));
    if (el.type === 'ListRow') shown.rows += 1;
    if (el.type === 'Button' && typeof props.label === 'string') shown.buttons.push(props.label);
    const children = [...(el.children ?? []), ...Object.values(el.slots ?? {}).flat()];
    if (!el.repeat) return children.forEach((child) => walk(child, item));
    const items = String(el.repeat.statePath).split('/').slice(1).reduce<unknown>((at, k) => (at as Record<string, unknown>)?.[k], state);
    const keys = (Array.isArray(items) ? items : []).map((it) => String((it as Record<string, unknown>)[el.repeat!.key ?? 'id']));
    expect(new Set(keys).size, `${key} repeats over items with distinct keys`).toBe(keys.length);
    (Array.isArray(items) ? items : []).forEach((repeatItem, repeatIndex) => children.forEach((child) => walk(child, { repeatItem, repeatIndex })));
  };
  walk(spec.root);
  return shown;
}

const text = (html: string) => html.replace(/<[^>]+>/g, '').replaceAll('&amp;', '&').replaceAll('&#x27;', '\'').replaceAll('&quot;', '"');
/** What SpecView drew: its h3 titles, its rows and the text of each button. */
const drawn = (html: string) => ({
  titles: [...html.matchAll(/<h3\b[^>]*>(.*?)<\/h3>/g)].map(([, t]) => text(t)),
  rows: html.match(/<li\b[^>]*data-row-id=/g)?.length ?? 0,
  buttons: [...html.matchAll(/<button\b[^>]*>(.*?)<\/button>/g)].map(([, t]) => text(t)),
});

describe.each(replies)('%s', (name, reply) => {
  test('parses, passes the check and draws its titles, rows and buttons once, render after render', async () => {
    const chunks = await stream(reply);
    expect(chunks.filter((c) => c.type === 'error')).toEqual([]);
    expect(chunks.filter((c) => c.type === 'text-delta').map((c) => c.delta).join('')).not.toMatch(/\{"op"/);
    const parts = chunks as Array<{ type: string; data?: unknown }>;
    const spec = specFromParts(parts)!;
    expect(spec?.elements[spec.root]).toBeDefined();
    expect(check(spec)).toEqual(issues[name.split('/')[1]] ?? []);
    expect(JSON.stringify(specFromParts(parts))).toBe(JSON.stringify(spec));

    const want = expected(spec);
    expect(want.titles.length).toBeGreaterThan(0);
    const html = renderToString(<SpecView spec={spec} headingLevel={3} />);
    const got = drawn(html);
    expect(got.titles).toEqual(want.titles);
    expect(got.rows).toBe(want.rows);
    for (const label of want.buttons) expect(got.buttons).toContain(label);
    expect(renderToString(<SpecView spec={specFromParts(parts)} headingLevel={3} />)).toBe(html);
  });
});
