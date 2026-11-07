import type { Spec } from '@json-render/core';
import type { CatalogAction } from '../screens/catalog';

/** How a note says each action, past tense. An action missing here reads “You chose <name> on …”. */
const DID: Partial<Record<CatalogAction, string>> = { open: 'opened', archive: 'archived', submit: 'pressed' };

const isExpression = (value: unknown) => !!value && typeof value === 'object' && Object.keys(value).some((k) => k.startsWith('$'));

/**
 * What a screen's action did, in words: “You opened Venue review.” The element whose binding ran it names it, and when
 * a field's Enter and a button both send a form, the button does. Only literal params pick the element. When none does,
 * or its label comes from state, as in a repeat, `fallback` names it: the control the person just used.
 */
export function describe(spec: Spec | null, name: string, params: Record<string, unknown>, fallback?: string) {
  const ran = (binding: unknown): boolean =>
    Array.isArray(binding) ? binding.some(ran)
    : !!binding && typeof binding === 'object' && (binding as { action?: string }).action === name
      && Object.entries((binding as { params?: Record<string, unknown> }).params ?? {}).every(([k, v]) => isExpression(v) || params[k] === v);
  const ranIt = Object.values(spec?.elements ?? {}).filter((el) => Object.values(el.on ?? {}).some(ran));
  const element = ranIt.find((el) => el.on?.press) ?? ranIt[0];
  const title = element?.props?.title ?? element?.props?.label;
  const label = typeof title === 'string' ? title : fallback;
  const verb = DID[name as CatalogAction] ?? `chose ${name} on`;
  return label ? `You ${verb} ${label}.` : `You ${verb} an item.`;
}
