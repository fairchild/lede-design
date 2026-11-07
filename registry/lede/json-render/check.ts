import { validateSpec, type Spec } from '@json-render/core';
import type { z } from 'zod';
import { catalog } from './catalog';

const components = catalog.data.components as Record<string, { props: z.ZodObject }>;

/** A prop value json-render resolves at render time, such as `{ "$bindState": "/form/name" }`. */
const isExpression = (value: unknown) =>
  !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).some((key) => key.startsWith('$'));

/**
 * Every issue with a spec, as a line of text. json-render's `catalog.validate` checks the spec's shape and that each
 * type is in the catalog, and `validateSpec` checks its structure. Neither reads an element's props, so the last pass
 * parses each one with its entry's schema, strictly, with the props bound to expressions, which json-render resolves later, made optional.
 */
export function check(spec: Spec): string[] {
  const shape = catalog.validate(spec);
  const issues = shape.success ? [] : shape.error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  issues.push(...validateSpec(spec).issues.map((i) => `${i.elementKey ?? 'spec'}: ${i.message}`));
  for (const [key, element] of Object.entries(spec.elements ?? {})) {
    const entry = components[element.type];
    if (!entry) continue;
    const entries = Object.entries(element.props ?? {});
    const bound = Object.fromEntries(entries.filter(([, value]) => isExpression(value)).map(([name]) => [name, true] as const));
    const literal = Object.fromEntries(entries.filter(([name]) => !(name in bound)));
    const props = entry.props.partial(bound as Record<string, true> & Record<number, never>).strict().safeParse(literal);
    for (const i of props.success ? [] : props.error.issues) issues.push(`elements.${key}.props${i.path.map((p) => `.${String(p)}`).join('')}: ${i.message}`);
  }
  return issues;
}
