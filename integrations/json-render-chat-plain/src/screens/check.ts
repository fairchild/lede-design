import { validateSpec, type Spec } from '@json-render/core';
import type { z } from 'zod';
import { catalog } from './catalog';

const components = catalog.data.components as Record<string, { props: z.ZodObject }>;

const isExpression = (value: unknown) =>
  !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).some((key) => key.startsWith('$'));

/**
 * Every issue with a spec, as a line of text: json-render's shape and structure checks, then each element's props
 * against its schema: a prop the schema doesn't have, whatever its value, then each value it rejects. The package marks unused props `.nullable()` and the prompt shows them as optional, so
 * a prop left out counts as null, and a prop bound to an expression is resolved later and skipped.
 */
export function check(spec: Spec): string[] {
  const shape = catalog.validate(spec);
  const issues = shape.success ? [] : shape.error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  issues.push(...validateSpec(spec).issues.map((i) => `${i.elementKey ?? 'spec'}: ${i.message}`));
  for (const [key, element] of Object.entries(spec.elements ?? {})) {
    const entry = components[element.type];
    if (!entry) continue;
    const known = (name: string) => name in entry.props.shape;
    for (const name of Object.keys(element.props ?? {}).filter((n) => !known(n))) issues.push(`elements.${key}.props: Unrecognized key: "${name}"`);
    const entries = Object.entries(element.props ?? {}).filter(([name]) => known(name));
    const bound = Object.fromEntries(entries.filter(([, value]) => isExpression(value)).map(([name]) => [name, true] as const));
    const literal = Object.fromEntries(entries.filter(([name]) => !(name in bound)));
    const absent = Object.keys(entry.props.shape).filter((name) => !(name in literal) && !(name in bound) && entry.props.shape[name].safeParse(null).success);
    const props = entry.props
      .partial(bound as Record<string, true> & Record<number, never>)
      .safeParse({ ...Object.fromEntries(absent.map((name) => [name, null])), ...literal });
    for (const i of props.success ? [] : props.error.issues) issues.push(`elements.${key}.props${i.path.map((p) => `.${String(p)}`).join('')}: ${i.message}`);
  }
  return issues;
}
