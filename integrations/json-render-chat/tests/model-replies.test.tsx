import { readdirSync, readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { pipeJsonRender, type Spec } from '@json-render/core';
import type { UIMessageChunk } from 'ai';
import { check, promises } from '@/components/lede/json-render/check';
import { specFromParts } from '@/components/lede/json-render/patches';
import { SpecView } from '@/components/lede/json-render/spec-view';

const DIR = new URL('./model-replies/', import.meta.url);
const replies = ['before', 'after'].flatMap((set) =>
  readdirSync(new URL(`${set}/`, DIR)).map((file) => [`${set}/${file}`, readFileSync(new URL(`${set}/${file}`, DIR), 'utf8')] as const));

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

/** Each repeated list's keys, which repeat itself would draw a row for. */
const repeatedKeys = (spec: Spec) => Object.values(spec.elements).flatMap((el) => {
  if (!el.repeat || typeof el.repeat.statePath !== 'string') return [];
  const items = el.repeat.statePath.split('/').slice(1).reduce<unknown>((at, key) => (at as Record<string, unknown>)?.[key], spec.state);
  return [(items as Array<Record<string, unknown>> ?? []).map((item) => String(item[el.repeat!.key ?? 'id']))];
});

describe.each(replies)('%s', (_, text) => {
  test('parses, passes the catalog and draws, with each list’s rows once, render after render', async () => {
    const chunks = await stream(text);
    expect(chunks.filter((c) => c.type === 'error')).toEqual([]);
    expect(chunks.filter((c) => c.type === 'text-delta').map((c) => c.delta).join('')).not.toMatch(/\{"op"/);
    const parts = chunks as Array<{ type: string; data?: unknown }>;
    const spec = specFromParts(parts)!;
    expect(spec?.elements[spec.root]).toBeDefined();
    // These replies were recorded before the catalog could open an item in place, so a row's press runs a host action
    // the catalog no longer has. Everything else about them still has to pass.
    const promised = new Set(promises(spec));
    expect(check(spec).filter((issue) => !promised.has(issue))).toEqual([]);
    expect(JSON.stringify(specFromParts(parts))).toBe(JSON.stringify(spec));
    for (const keys of repeatedKeys(spec)) expect(new Set(keys).size).toBe(keys.length);
    expect(() => renderToString(<SpecView spec={spec} headingLevel={3} />)).not.toThrow();
  });
});
