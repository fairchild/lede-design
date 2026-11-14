import registry from '../../../registry.json';
import { CodeExample } from './CodeExample';

/** Each file in `samples/` is the smallest working use of the registry item it's named for, typechecked with the site. */
const SAMPLES = import.meta.glob<string>('./samples/*.tsx', { query: '?raw', import: 'default', eager: true });

const byName = new Map(registry.items.map((item) => [item.name, item]));
const itemFor = new Map(registry.items.flatMap((item) => item.files.map((file) => [file.path.replace(/\.tsx?$/, ''), item.name] as const)));

/** Every item that installing `names` brings along, through `registryDependencies`. */
function withDependencies(names: string[], into = new Set<string>()) {
  for (const name of names) {
    if (into.has(name)) continue;
    into.add(name);
    withDependencies((byName.get(name)?.registryDependencies ?? []).map((dep) => dep.replace(/^@lede\//, '')), into);
  }
  return into;
}

/** The section's items, then each item the sample imports that they don't already install. */
export function itemsToInstall(items: string[], code = '') {
  const installed = withDependencies(items);
  const imported = [...code.matchAll(/from '@\/components\/lede\/([^']+)'/g)].map(([, path]) => itemFor.get(`registry/lede/${path}`));
  const missing = [...new Set(imported)].filter((name): name is string => !!name && !installed.has(name));
  return [...items, ...missing.filter((name) => !missing.some((other) => other !== name && withDependencies([other]).has(name)))];
}

export const installCommand = (items: string[]) => `npx shadcn@latest add ${items.map((item) => `@lede/${item}`).join(' ')}`;

/** How to use a section's registry items: the install command and, when the first item has a sample, its code. Both start closed. */
export function Usage({ title, items }: { title: string; items: string[] }) {
  const code = SAMPLES[`./samples/${items[0]}.tsx`];
  return (
    <div className="docs-usage">
      <CodeExample label={`Install ${title}`} language="shell" code={installCommand(itemsToInstall(items, code))} />
      {code ? <CodeExample label={`Code for ${title}`} language="tsx" code={code.trim()} /> : null}
    </div>
  );
}
