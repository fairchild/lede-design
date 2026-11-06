// A registry file's relative imports have to land on files the CLI installs alongside it: its own item's, or those of
// its registryDependencies, transitively. `shadcn build` reads no imports and `tsc` sees the whole repo at once, so
// neither notices a missing dependency. Paths resolve from each file's `target`, the place it lands in a project.
// The repo-only aliases `@/` and `@lede/` go through the same walk, where they can't resolve.
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import ts from 'typescript';

const NAMESPACE = '@lede/';
const ENDINGS = ['', '.ts', '.tsx'];

const { items } = JSON.parse(readFileSync('registry.json', 'utf8'));
const byAddress = new Map(items.map((item) => [`${NAMESPACE}${item.name}`, item]));
const problems = [];
let checked = 0;

/** Every item a CLI install of `item` brings in, itself included. */
function closure(item, seen = new Set()) {
  if (!item || seen.has(item)) return seen;
  seen.add(item);
  for (const dep of item.registryDependencies ?? []) closure(byAddress.get(dep), seen);
  return seen;
}

const importsOf = (path) => {
  const text = readFileSync(path, 'utf8');
  return path.endsWith('.css')
    ? [...text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/@import\s+(?:url\()?["']([^"']+)/g)].map((match) => match[1])
    : ts.preProcessFile(text, true, true).importedFiles.map((file) => file.fileName);
};

for (const item of items) {
  if (!item.files?.length) problems.push(`${item.name}: lists no files`);
  for (const dep of item.registryDependencies ?? []) {
    if (!byAddress.has(dep)) problems.push(`${item.name}: unknown registry dependency ${dep}`);
  }
  const installed = new Set([...closure(item)].flatMap(({ files = [] }) => files.map((file) => file.target)));
  for (const file of item.files ?? []) {
    if (!file.target) {
      problems.push(`${item.name}: ${file.path} has no target`);
      continue;
    }
    for (const specifier of importsOf(file.path).filter((name) => /^(\.|@\/|@lede\/)/.test(name))) {
      const resolved = posix.join(posix.dirname(file.target), specifier);
      checked += 1;
      if (!ENDINGS.some((ending) => installed.has(resolved + ending))) {
        problems.push(`${item.name}: ${file.path} imports ${specifier}, but ${resolved} isn't in the item or its registryDependencies`);
      }
    }
  }
}

if (problems.length) {
  console.error(`check-registry: ${problems.length} problem(s)\n${problems.map((problem) => `  ${problem}`).join('\n')}`);
  process.exit(1);
}
console.log(`check-registry: ${items.length} items, ${checked} relative imports resolved`);
