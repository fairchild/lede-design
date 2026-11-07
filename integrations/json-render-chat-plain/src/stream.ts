import type { Spec } from '@json-render/core';

/**
 * A spec as the JSONL patches a model streams: the root, the state and then each element after its parent, so the
 * screen fills in from the top.
 */
export function toPatches(spec: Spec): string[] {
  const lines: Array<{ op: 'add'; path: string; value: unknown }> = [{ op: 'add', path: '/root', value: spec.root }];
  if (spec.state) lines.push({ op: 'add', path: '/state', value: spec.state });
  const queue = [spec.root];
  for (const seen = new Set<string>(); queue.length; ) {
    const key = queue.shift()!;
    const element = spec.elements[key];
    if (!element || seen.has(key)) continue;
    seen.add(key);
    lines.push({ op: 'add', path: `/elements/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`, value: element });
    queue.push(...(element.children ?? []), ...Object.values(element.slots ?? {}).flat());
  }
  return lines.map((line) => `${JSON.stringify(line)}\n`);
}
