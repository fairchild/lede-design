// The registry gate in scripts/check-registry.mjs, run on mutated copies of registry/ and registry.json. Each case adds
// the file or listing it tests, so a later change to the registry can't break it.
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test, expect } from '@playwright/test';

type Json = Record<string, any>;

test.skip(({ isMobile }) => isMobile, 'No browser: one project is enough.');

const SCRIPT = resolve('scripts/check-registry.mjs');
const BUTTON = 'registry/lede/button.tsx';

const item = (json: Json, name: string) => json.items.find((candidate: Json) => candidate.name === name);
const write = (dir: string, file: string, text: string) => {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), text);
};
/** Adds a file to registry/ and lists it in a new item that depends on lede-utils. */
const listed = (json: Json, path: string, target: string, extra: Json = {}) => json.items.push({
  name: 'x', type: 'registry:ui', title: 'X', registryDependencies: ['@lede/lede-utils'], files: [{ path, type: 'registry:ui', target }], ...extra,
});

function gate(mutate: (dir: string, json: Json) => void = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'registry-gate-'));
  cpSync('registry', join(dir, 'registry'), { recursive: true });
  const json = JSON.parse(readFileSync('registry.json', 'utf8'));
  mutate(dir, json);
  writeFileSync(join(dir, 'registry.json'), JSON.stringify(json));
  const { status, stdout, stderr } = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: 'utf8' });
  rmSync(dir, { recursive: true });
  return { status, output: stdout + stderr };
}

test('passes on the repo as it stands, in one line with its counts', () => {
  const { status, output } = gate();
  expect(status).toBe(0);
  expect(output.trim()).toMatch(/^check-registry: \d+ items, \d+ imports resolved$/);
});

test('fails a relative import its item doesn\'t install, and the site\'s aliases', () => {
  const { status, output } = gate((dir) => appendFileSync(join(dir, BUTTON), "\nimport './list';\nimport '@/lib/x';\nimport '@lede/list';\n"));
  expect(status).toBe(1);
  expect(output).toContain(`button: ${BUTTON} imports ./list, but components/lede/list isn't in the item or its registryDependencies`);
  expect(output).toContain(`button: ${BUTTON} imports @/lib/x`);
  expect(output).toContain(`button: ${BUTTON} imports @lede/list`);
  expect(output).toContain('3 problem(s)');
});

test('fails a package its item and their registryDependencies don\'t list, and takes React and a listed package', () => {
  const { status, output } = gate((dir, json) => {
    write(dir, 'registry/lede/x.tsx', [
      "import { motion } from 'motion/react';",
      "import { z } from 'zod';",
      "import type { Row } from '@tanstack/react-table';",
      "type Table = typeof import('@tanstack/table-core');",
      "import { useState } from 'react';",
      "import { createPortal } from 'react-dom';",
      "import { Menu } from '@base-ui/react/menu';",
      "export { z } from 'zod/mini';",
    ].join('\n'));
    listed(json, 'registry/lede/x.tsx', 'components/lede/x.tsx', { dependencies: ['@base-ui/react@^1.9.0'] });
  });
  expect(status).toBe(1);
  expect(output).toContain("x: registry/lede/x.tsx imports motion/react, but motion isn't in the dependencies of the item or its registryDependencies");
  expect(output).toContain('x: registry/lede/x.tsx imports zod, but zod isn');
  expect(output).toContain('x: registry/lede/x.tsx imports zod/mini, but zod isn');
  expect(output).toContain('x: registry/lede/x.tsx imports @tanstack/react-table, but @tanstack/react-table isn');
  expect(output).toContain('x: registry/lede/x.tsx imports @tanstack/table-core, but @tanstack/table-core isn');
  expect(output).toContain('5 problem(s)');
});

test('takes a package a registryDependency lists, transitively', () => {
  const { status } = gate((dir, json) => {
    write(dir, 'registry/lede/x.tsx', "import type { Row } from '@tanstack/react-table';\n");
    listed(json, 'registry/lede/x.tsx', 'components/lede/x.tsx', { registryDependencies: ['@lede/data-table'] });
  });
  expect(status).toBe(0);
});

test('fails a CSS @import that isn\'t installed, quoted, in url() or in an unquoted url()', () => {
  const { status, output } = gate((dir) => appendFileSync(join(dir, 'registry/lede/lede.index.css'), '\n@import "./a.css";\n@import url("./b.css");\n@import url(./c.css) layer(x);\n@import URL( ./d.css );\n'));
  expect(status).toBe(1);
  for (const name of ['a', 'b', 'c', 'd']) expect(output).toContain(`lede-theme: registry/lede/lede.index.css imports ./${name}.css, but styles/lede/${name}.css isn't`);
  expect(output).toContain('4 problem(s)');
});

test('fails a dynamic import with a computed path, and follows one with a string path', () => {
  const { status, output } = gate((dir) => appendFileSync(join(dir, BUTTON), '\nconst name = "list";\nvoid import(`../${name}`);\nvoid import("../" + name);\nvoid import(`./list`);\n'));
  expect(status).toBe(1);
  expect(output.split(`button: ${BUTTON} has a dynamic import with a computed path, which this check can't follow. Import a string path.`)).toHaveLength(3);
  expect(output).toContain(`button: ${BUTTON} imports ./list, but components/lede/list isn't`);
  expect(output).toContain('3 problem(s)');
});

test('fails two files with one target, and a file under registry/ that no item lists', () => {
  const { status, output } = gate((dir, json) => {
    write(dir, 'registry/lede/x.tsx', 'export {};\n');
    write(dir, 'registry/lede/blocks/stray.tsx', 'export {};\n');
    write(dir, 'registry/lede/stray.css', '');
    listed(json, 'registry/lede/x.tsx', item(json, 'button').files[0].target);
  });
  expect(status).toBe(1);
  expect(output).toContain('components/lede/button.tsx is the target of button: registry/lede/button.tsx and x: registry/lede/x.tsx, so one install overwrites the other');
  expect(output).toContain('registry/lede/blocks/stray.tsx is in no item in registry.json, so nothing installs it');
  expect(output).toContain('registry/lede/stray.css is in no item');
  expect(output).toContain('3 problem(s)');
});
