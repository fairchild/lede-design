/** Joins class names, skipping falsy values. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** A block's labels: `defaults`, with each of `given` that isn't `undefined` in its place. */
export function withLabels<T extends object>(defaults: T, given: Partial<T> | undefined): T {
  const out = { ...defaults };
  if (given) for (const key of Object.keys(given) as Array<keyof T>) if (given[key] !== undefined) out[key] = given[key] as T[keyof T];
  return out;
}
