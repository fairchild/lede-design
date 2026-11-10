// A registry file's imports have to land on what the CLI installs alongside it. A relative import lands on a file of its
// own item or of its registryDependencies, transitively, and a package import on a package one of those items lists in
// `dependencies`. `shadcn build` reads no imports and `tsc` sees the whole repo at once, so neither notices a missing
// dependency. Paths resolve from each file's `target`, the place it lands in a project. The repo-only aliases `@/` and
// `@lede/` go through the same walk, where they can't resolve. A dynamic import with a computed path can't be resolved,
// so it fails. Each target belongs to one file, and every file under registry/ but the `index.ts` barrels is in an item.
import { readdirSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
import ts from 'typescript';

const NAMESPACE = '@lede/';
const ENDINGS = ['', '.ts', '.tsx'];
/** A project that installs Lede has React already, so no item lists it. */
const PEERS = new Set(['react', 'react-dom']);

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

/** "@base-ui/react@^1.9.0" and "@base-ui/react/menu" are both the package "@base-ui/react". */
const packageOf = (name) => name.split('/').slice(0, name.startsWith('@') ? 2 : 1).join('/').replace(/(.)@.*$/, '$1');

/** Each import's specifier, or null for a dynamic import whose path is computed. */
const importsOf = (path) => {
  const text = readFileSync(path, 'utf8');
  if (path.endsWith('.css')) {
    return [...text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/@import\s+(?:url\(\s*)?(["']?)([^"'\s;)]+)\1/gi)].map((match) => match[2]);
  }
  const found = [];
  const visit = (node) => {
    const literal = (arg) => (arg && ts.isStringLiteralLike(arg) ? arg.text : null);
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) found.push(literal(node.moduleSpecifier));
    else if (ts.isExternalModuleReference(node)) found.push(literal(node.expression));
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) found.push(literal(node.argument.literal));
    else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) found.push(literal(node.arguments[0]));
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS));
  return found;
};

const owners = new Map();
for (const item of items) {
  if (!item.files?.length) problems.push(`${item.name}: lists no files`);
  for (const dep of item.registryDependencies ?? []) {
    if (!byAddress.has(dep)) problems.push(`${item.name}: unknown registry dependency ${dep}`);
  }
  const brought = [...closure(item)];
  const installed = new Set(brought.flatMap(({ files = [] }) => files.map((file) => file.target)));
  const packages = new Set(brought.flatMap(({ dependencies = [] }) => dependencies.map(packageOf)));
  for (const file of item.files ?? []) {
    owners.set(file.path, item.name);
    if (!file.target) {
      problems.push(`${item.name}: ${file.path} has no target`);
      continue;
    }
    for (const specifier of importsOf(file.path)) {
      checked += 1;
      if (specifier === null) {
        problems.push(`${item.name}: ${file.path} has a dynamic import with a computed path, which this check can't follow. Import a string path.`);
      } else if (/^(\.|@\/|@lede\/)/.test(specifier)) {
        const resolved = posix.join(posix.dirname(file.target), specifier);
        if (!ENDINGS.some((ending) => installed.has(resolved + ending))) {
          problems.push(`${item.name}: ${file.path} imports ${specifier}, but ${resolved} isn't in the item or its registryDependencies`);
        }
      } else if (!PEERS.has(packageOf(specifier)) && !packages.has(packageOf(specifier))) {
        problems.push(`${item.name}: ${file.path} imports ${specifier}, but ${packageOf(specifier)} isn't in the dependencies of the item or its registryDependencies`);
      }
    }
  }
}

const byTarget = Object.groupBy(items.flatMap((item) => (item.files ?? []).filter((file) => file.target).map((file) => ({ ...file, item: item.name }))), (file) => file.target);
for (const [target, files] of Object.entries(byTarget)) {
  if (files.length > 1) problems.push(`${target} is the target of ${files.map(({ item, path }) => `${item}: ${path}`).join(' and ')}, so one install overwrites the other`);
}

for (const file of readdirSync('registry', { recursive: true, withFileTypes: true })) {
  const path = posix.join(file.parentPath.split('\\').join('/'), file.name);
  if (file.isFile() && file.name !== 'index.ts' && !owners.has(path)) problems.push(`${path} is in no item in registry.json, so nothing installs it`);
}

if (problems.length) {
  console.error(`check-registry: ${problems.length} problem(s)\n${problems.map((problem) => `  ${problem}`).join('\n')}`);
  process.exit(1);
}
console.log(`check-registry: ${items.length} items, ${checked} imports resolved`);
