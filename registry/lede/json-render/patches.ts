import { SPEC_DATA_PART_TYPE, type Spec } from '@json-render/core';
import { buildSpecFromParts } from '@json-render/react';

const pointer = (key: string) => key.replaceAll('~', '~0').replaceAll('/', '~1');

/**
 * A spec as the JSONL patches a model streams: the root, the state, with each array an item at a time as json-render's
 * prompt asks, and then each element after its parent, so the screen fills in from the top. A mock transport replays these, and a server can send them back to the model, so it
 * sees the screens it sent in earlier turns.
 */
export function toPatches(spec: Spec): string[] {
  const lines: Array<{ op: 'add'; path: string; value: unknown }> = [{ op: 'add', path: '/root', value: spec.root }];
  if (spec.state) {
    lines.push({ op: 'add', path: '/state', value: {} });
    for (const [key, value] of Object.entries(spec.state)) {
      const path = `/state/${pointer(key)}`;
      if (!Array.isArray(value)) lines.push({ op: 'add', path, value });
      else lines.push({ op: 'add', path, value: [] }, ...value.map((item, i) => ({ op: 'add' as const, path: `${path}/${i}`, value: item })));
    }
  }
  const queue = [spec.root];
  for (const seen = new Set<string>(); queue.length; ) {
    const key = queue.shift()!;
    const element = spec.elements[key];
    if (!element || seen.has(key)) continue;
    seen.add(key);
    lines.push({ op: 'add', path: `/elements/${pointer(key)}`, value: element });
    queue.push(...(element.children ?? []), ...Object.values(element.slots ?? {}).flat());
  }
  return lines.map((line) => `${JSON.stringify(line)}\n`);
}

/**
 * The spec a message's parts build, without changing them. json-render's `buildSpecFromParts` applies each patch's
 * value as it is, so a later patch such as `/state/items/0` writes into an array an earlier patch carried, and a second
 * build adds the items again: a list re-rendered while it streams grows on every render. This builds from copies.
 */
export function specFromParts(parts: ReadonlyArray<{ type: string; data?: unknown }>): Spec | null {
  return buildSpecFromParts(parts.filter((part) => part.type === SPEC_DATA_PART_TYPE).map((part) => ({ type: part.type, data: structuredClone(part.data) })));
}
