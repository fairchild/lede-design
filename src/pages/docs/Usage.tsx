import { CodeExample } from './CodeExample';

/** Each file in `samples/` is the smallest working use of the registry item it's named for, typechecked with the site. */
const SAMPLES = import.meta.glob<string>('./samples/*.tsx', { query: '?raw', import: 'default', eager: true });

export const installCommand = (items: string[]) => `npx shadcn@latest add ${items.map((item) => `@lede/${item}`).join(' ')}`;

/** How to use a section's registry items: the install command and, when the first item has a sample, its code. Both start closed. */
export function Usage({ title, items }: { title: string; items: string[] }) {
  const code = SAMPLES[`./samples/${items[0]}.tsx`];
  return (
    <div className="docs-usage">
      <CodeExample label={`Install ${title}`} language="shell" code={installCommand(items)} />
      {code ? <CodeExample label={`Code for ${title}`} language="tsx" code={code.trim()} /> : null}
    </div>
  );
}
