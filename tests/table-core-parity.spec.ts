// Lede keeps its own copy of the server-rows store, the shadcn way: the source installs with the block. The copy
// follows @fairchild/table-core, where the store's tests live. This spec fails when the copy differs from the table-core
// release it is pinned to, so the two can't drift apart unnoticed. No network: each pin is a hash of the normalized
// source, and setting TABLE_CORE to a table-core checkout checks the pins against that commit.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { test, expect } from '@playwright/test';

test.skip(({ isMobile }) => isMobile, 'No browser: one project is enough.');

const PIN = {
  version: '0.1.0',
  commit: '4499f50fd6201b8a72aba83e7fe4e5f46419f152',
  /** registry/lede/blocks/server-rows-store.ts ↔ src/server-rows-store.ts, all but the import lines. */
  store: 'a73ad5609889567ea68fa98b7662a261608d56bd53f9ffa1fbb8f3d1a34e49c5',
  /** The shared types and two selection functions in use-data-table.ts ↔ src/types.ts and src/selection.ts, as code. */
  shared: 'eb4ee6ba98850e5ab92c081f74c870aac939e457ecdb118201e8011285e3e81f',
};

/** Declarations Lede redeclares in use-data-table.ts (SortDirection comes from table.tsx). Their doc comments differ. */
const SHARED = ['SortDirection', 'SortItem', 'TableView', 'FilterValue', 'TableFilter', 'Selection', 'Total', 'TableState', 'isSelected', 'removeFromSelection'];

const sha = (text: string) => createHash('sha256').update(text).digest('hex');

/** The store's source without its import lines, which differ by install layout. */
const storeHash = (source: string) => sha(source.split('\n').filter((line) => !/^import\b/.test(line)).join('\n'));

/** The named declarations, printed without comments or formatting, in SHARED's order. */
function sharedHash(files: Record<string, string>) {
  const printer = ts.createPrinter({ removeComments: true });
  const found = new Map<string, string>();
  for (const [name, source] of Object.entries(files)) {
    const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
    for (const node of file.statements) {
      if (!(ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isFunctionDeclaration(node))) continue;
      const id = node.name?.text;
      if (id && SHARED.includes(id)) found.set(id, printer.printNode(ts.EmitHint.Unspecified, node, file));
    }
  }
  const missing = SHARED.filter((id) => !found.has(id));
  expect(missing, `declarations not found: ${missing.join(', ')}`).toEqual([]);
  return sha(SHARED.map((id) => found.get(id)).join('\n'));
}

const RESYNC = (what: string, how: string) =>
  `${what} differs from @fairchild/table-core ${PIN.version} (${PIN.commit}). A change to the store belongs in ` +
  `table-core first. To re-sync, ${how} To re-pin, set PIN.version and PIN.commit to the release, run ` +
  `TABLE_CORE=<path to a table-core checkout> npx playwright test table-core-parity --project=desktop and copy the ` +
  `hashes it prints into PIN.`;

test('the server-rows store matches the pinned table-core release', () => {
  const hash = storeHash(readFileSync('registry/lede/blocks/server-rows-store.ts', 'utf8'));
  expect(hash, RESYNC(
    'registry/lede/blocks/server-rows-store.ts',
    'copy src/server-rows-store.ts from table-core at the pinned commit and keep Lede\'s import line.',
  )).toBe(PIN.store);
});

test('the shared types and selection functions match the pinned table-core release', () => {
  const hash = sharedHash({
    'use-data-table.ts': readFileSync('registry/lede/blocks/use-data-table.ts', 'utf8'),
    'table.tsx': readFileSync('registry/lede/table.tsx', 'utf8'),
  });
  expect(hash, RESYNC(
    `${SHARED.join(', ')} in use-data-table.ts`,
    'match each to src/types.ts or src/selection.ts at the pinned commit. Doc comments can stay Lede\'s own.',
  )).toBe(PIN.shared);
});

test('the pins are table-core’s, at the pinned commit', () => {
  const dir = process.env.TABLE_CORE;
  test.skip(!dir, 'Set TABLE_CORE to a table-core checkout to check the pins.');
  const show = (path: string) => execFileSync('git', ['-C', dir!, 'show', `${PIN.commit}:${path}`], { encoding: 'utf8' });
  const version = JSON.parse(show('package.json')).version;
  const actual = {
    version,
    commit: PIN.commit,
    store: storeHash(show('src/server-rows-store.ts')),
    shared: sharedHash({ 'types.ts': show('src/types.ts'), 'selection.ts': show('src/selection.ts') }),
  };
  expect(actual, `table-core at ${PIN.commit} gives these pins`).toEqual(PIN);
});
