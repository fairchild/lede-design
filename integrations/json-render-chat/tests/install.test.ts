import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The files a reader copies import Lede from `@/components/lede/…`. Each such import has to be a file that the
// documented install command brings in, through the items it names and theirs.

const here = (path: string) => new URL(path, import.meta.url).pathname;
interface Item { name: string; registryDependencies?: string[]; files: Array<{ path: string; target?: string }> }
const items = new Map((JSON.parse(readFileSync(here('../../../registry.json'), 'utf8')) as { items: Item[] }).items.map((i) => [i.name, i]));

/** Every file the named items install, by its target path without the extension, such as `components/lede/avatar`. */
function installed(names: string[]): Set<string> {
  const seen = new Set<string>();
  const visit = (name: string) => {
    const item = items.get(name.replace(/^@lede\//, ''));
    if (!item || seen.has(item.name)) return;
    seen.add(item.name);
    item.registryDependencies?.forEach(visit);
  };
  names.forEach(visit);
  return new Set([...seen].flatMap((n) => items.get(n)!.files.map((f) => (f.target ?? f.path).replace(/\.(tsx?|css)$/, ''))));
}

const copied = (dir: string): string[] =>
  readdirSync(here(dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? copied(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
const imports = [...copied('../src/chat'), '../server/chat.ts'].flatMap((file) =>
  [...readFileSync(here(file), 'utf8').matchAll(/from '@\/components\/lede\/([^']+)'/g)].map((m) => ({ file, path: `components/lede/${m[1]}` })));

/** The `npx shadcn@latest add …` command a doc gives, as its item names. */
const command = (doc: string) => {
  const line = readFileSync(here(doc), 'utf8').match(/npx shadcn@latest add ((?:@lede\/\S+ ?)+)/);
  return line![1].trim().split(' ');
};

describe('the documented install brings every Lede file the copied chat imports', () => {
  for (const doc of ['../README.md', '../AGENTS.md']) {
    it(doc.slice(3), () => {
      const files = installed(command(doc));
      expect(imports.length).toBeGreaterThan(0);
      expect(imports.filter(({ path }) => !files.has(path))).toEqual([]);
    });
  }
});
