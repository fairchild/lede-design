import { validateSpec, type Spec } from '@json-render/core';
import type { z } from 'zod';
import { catalog } from './catalog';

const components = catalog.data.components as Record<string, { props: z.ZodObject }>;

/** A prop value json-render resolves at render time, such as `{ "$bindState": "/form/name" }`. */
const isExpression = (value: unknown) =>
  !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).some((key) => key.startsWith('$'));

/** Every `$state` path a condition reads, such as `/open` in `[{ "$state": "/open" }, { "$item": "id", "eq": { "$state": "/open" } }]`. */
const reads = (condition: unknown): string[] =>
  !condition || typeof condition !== 'object' ? []
  : Object.entries(condition).flatMap(([key, value]) => (key === '$state' && typeof value === 'string' ? [value] : reads(value)));
const bindings = (bound: unknown) => (Array.isArray(bound) ? bound : bound ? [bound] : []) as Array<{ action?: string; params?: { statePath?: unknown } }>;

/**
 * Presses that promise more than the spec holds. A ListRow's press draws a chevron, which says the row opens
 * something, so its press sets a path that a View's `visible` reads. A detail's PageHeader with `back` binds “back”.
 */
export function promises(spec: Spec): string[] {
  const elements = Object.entries(spec.elements ?? {});
  const views = new Set(elements.filter(([, el]) => el.type === 'View').flatMap(([, el]) => reads(el.visible)));
  return elements.flatMap(([key, el]) => {
    if (el.type === 'ListRow' && el.on?.press && !bindings(el.on.press).some((b) => b.action === 'setState' && views.has(String(b.params?.statePath))))
      return [`elements.${key}.on.press: a row's press shows a chevron, so it opens a View: set the path a View's visible reads, or leave press out`];
    if (el.type === 'PageHeader' && el.props?.back && !el.on?.back)
      return [`elements.${key}.on.back: a PageHeader with back binds “back” to the setState that shows the list View again`];
    return [];
  });
}

/**
 * Every issue with a spec, as a line of text. json-render's `catalog.validate` checks the spec's shape and that each
 * type is in the catalog, and `validateSpec` checks its structure. Neither reads an element's props, so the last pass
 * parses each one with its entry's schema, strictly, with the props bound to expressions, which json-render resolves later, made optional.
 * The last checks what a press promises.
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
  issues.push(...promises(spec));
  return issues;
}
