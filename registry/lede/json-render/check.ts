import { validateSpec, type ActionBinding, type Spec, type UIElement } from '@json-render/core';
import { z } from 'zod';
import { catalog, functions } from './catalog';

type Entry = { props: z.ZodObject; events?: readonly string[]; slots?: readonly string[] };
const components = catalog.data.components as Record<string, Entry>;
const statePath = z.string().startsWith('/');
/** The params of each action a spec can bind: json-render's built-ins, then the catalog's own. */
const actions: Record<string, z.ZodObject> = {
  setState: z.object({ statePath, value: z.unknown() }),
  pushState: z.object({ statePath, value: z.unknown(), clearStatePath: statePath.optional() }),
  removeState: z.object({ statePath, index: z.number().int().min(0) }),
  validateForm: z.object({ statePath: statePath.optional() }),
  ...Object.fromEntries(Object.entries(catalog.data.actions).map(([name, a]) => [name, a.params as z.ZodObject])),
};

/** A value json-render resolves at render time, such as `{ "$bindState": "/form/name" }`. */
const isExpression = (value: unknown) =>
  !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).some((key) => key.startsWith('$'));
const list = (bound: ActionBinding | ActionBinding[] | undefined) => (Array.isArray(bound) ? bound : bound ? [bound] : []);

/** Every `$state` path a condition reads, such as `/open` in `[{ "$state": "/open" }, { "$item": "id", "eq": { "$state": "/open" } }]`. */
const reads = (condition: unknown): string[] =>
  !condition || typeof condition !== 'object' ? []
  : Object.entries(condition).flatMap(([key, value]) => (key === '$state' && typeof value === 'string' ? [value] : reads(value)));
/** Each function a value calls with `$computed`, at any depth. */
const computed = (value: unknown): string[] =>
  !value || typeof value !== 'object' ? []
  : [...(typeof (value as { $computed?: unknown }).$computed === 'string' ? [(value as { $computed: string }).$computed] : []), ...Object.values(value).flatMap(computed)];
/** The tests a `visible` joins, each a test of one value. */
const tests = (visible: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(visible)) return visible.flatMap(tests);
  if (!visible || typeof visible !== 'object') return [];
  const v = visible as Record<string, unknown>;
  return v.$and || v.$or ? tests(v.$and ?? v.$or) : [v];
};

/**
 * Whether setting `path` to `value` shows a View of `spec`: one whose `visible` reads the path and passes for it. A
 * literal `eq` passes for its own value, `not` for an empty one, and a test against another value, such as an item's
 * id in a repeated detail, for any value that isn't empty. A value json-render fills in, such as `{ "$template": "${id}" }`,
 * counts as one that isn't empty.
 */
export function showsView(spec: Spec, path: unknown, value: unknown): boolean {
  const filled = isExpression(value) || !!value;
  return Object.values(spec.elements ?? {}).some((el) => el.type === 'View' && tests(el.visible).some((t) => {
    if (t.$state !== path) return reads(t).includes(String(path)) && filled;
    if ('eq' in t && !isExpression(t.eq)) return isExpression(value) || t.eq === value;
    return t.not === true ? !filled : filled;
  }));
}

/** Whether a binding opens a View of `spec` in place: one of its actions sets the path that View's `visible` reads. */
export const opensView = (spec: Spec, bound: ActionBinding | ActionBinding[] | undefined) =>
  list(bound).some((b) => b.action === 'setState' && showsView(spec, b.params?.statePath, b.params?.value));

/**
 * Presses that promise more than the spec holds. A ListRow's press draws a chevron, which says the row opens
 * something, so its press sets a path that a View's `visible` reads. A detail's PageHeader with `back` binds “back”.
 */
export function promises(spec: Spec): string[] {
  return Object.entries(spec.elements ?? {}).flatMap(([key, el]) => {
    if (el.type === 'ListRow' && el.on?.press && !opensView(spec, el.on.press))
      return [`elements.${key}.on.press: a row's press shows a chevron, so it opens a View: set the path a View's visible reads, or leave press out`];
    if (el.type === 'PageHeader' && el.props?.back && !el.on?.back)
      return [`elements.${key}.on.back: a PageHeader with back binds “back” to the setState that shows the list View again`];
    return [];
  });
}

/**
 * Each issue with values against a schema. A key the schema doesn't have is one, whatever its value. A value bound to
 * an expression, which json-render resolves later, may be left out.
 */
function parse(where: string, schema: z.ZodObject, values: Record<string, unknown>): string[] {
  const known = Object.entries(values).filter(([name]) => name in schema.shape);
  const unknown = Object.keys(values).filter((name) => !(name in schema.shape)).map((name) => `${where}: Unrecognized key: "${name}"`);
  const bound = Object.fromEntries(known.filter(([, value]) => isExpression(value)).map(([name]) => [name, true] as const));
  const parsed = schema.partial(bound as Record<string, true> & Record<number, never>).safeParse(Object.fromEntries(known.filter(([name]) => !(name in bound))));
  return [...unknown, ...(parsed.success ? [] : parsed.error.issues.map((i) => `${where}${i.path.map((p) => `.${String(p)}`).join('')}: ${i.message}`))];
}

/** An action that doesn't exist, or params its schema rejects. */
function action(where: string, b: ActionBinding): string[] {
  const schema = actions[b.action];
  if (!schema) return [`${where}.action: there is no action “${b.action}”. The actions are ${Object.keys(actions).join(', ')}.`];
  return parse(`${where}.params`, schema, b.params ?? {});
}

/** Each issue with an element's `on` and `watch`: an event its type doesn't emit, and each binding's action. */
function bindings(key: string, element: UIElement, entry: Entry): string[] {
  const at = (where: string, bound: ActionBinding | ActionBinding[]) =>
    list(bound).flatMap((b, i) => action(Array.isArray(bound) ? `${where}.${i}` : where, b));
  const on = Object.entries(element.on ?? {}).flatMap(([event, bound]) => [
    ...(entry.events?.includes(event) ? [] : [`elements.${key}.on.${event}: ${element.type} has no event “${event}”.${entry.events?.length ? ` Its events are ${entry.events.join(', ')}.` : ''}`]),
    ...at(`elements.${key}.on.${event}`, bound),
  ]);
  const watch = Object.entries(element.watch ?? {}).flatMap(([path, bound]) => at(`elements.${key}.watch.${path}`, bound));
  return [...on, ...watch];
}

/**
 * Every issue with a spec, as a line of text. json-render's `catalog.validate` checks the spec's shape and that each
 * type is in the catalog, and `validateSpec` checks its structure. Neither reads an element's props or bindings, so
 * the next passes parse each element's props with its entry's schema, check each `on` and `watch` binding's event,
 * action and params, and each slot and `$computed` function it names. The last checks what a press promises.
 */
export function check(spec: Spec): string[] {
  const shape = catalog.validate(spec);
  const issues = shape.success ? [] : shape.error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  issues.push(...validateSpec(spec).issues.map((i) => `${i.elementKey ?? 'spec'}: ${i.message}`));
  for (const [key, element] of Object.entries(spec.elements ?? {})) {
    const entry = components[element.type];
    if (!entry) continue;
    issues.push(...parse(`elements.${key}.props`, entry.props, element.props ?? {}));
    issues.push(...bindings(key, element, entry));
    for (const slot of Object.keys(element.slots ?? {}).filter((s) => s === 'default' || !entry.slots?.includes(s)))
      issues.push(`elements.${key}.slots.${slot}: ${element.type} has no slot “${slot}”.${slot === 'default' ? ' Its children fill the default slot.' : ''}`);
    for (const name of computed([element.props, element.visible, element.on, element.watch]).filter((n) => !(n in functions)))
      issues.push(`elements.${key}: there is no function “${name}” for $computed. The functions are ${Object.keys(functions).join(', ')}.`);
  }
  issues.push(...promises(spec));
  return issues;
}
