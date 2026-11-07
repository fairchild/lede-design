// Copies the chat and its json-render catalog into an app, at the paths its imports expect:
//   node integrations/json-render-chat/scripts/copy-into.mjs path/to/your-app
// The app needs the `@/*` alias for `src/*` and the Lede items from the README's step 1. Existing copies are replaced.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = process.argv[2];
if (!app || !existsSync(join(app, 'package.json'))) {
  console.error('Usage: node copy-into.mjs <app folder with a package.json>');
  process.exit(1);
}
const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = resolve(here, '../json-render');

/** [from, to] pairs, relative to this entry and to the app. */
const files = [
  ...['catalog.ts', 'registry.tsx', 'check.ts', 'stream.ts', 'specs.ts', 'catalog-fit.ts'].map((f) => [join(catalog, 'src', f), `src/json-render/${f}`]),
  ...readdirSync(join(catalog, 'specs')).map((f) => [join(catalog, 'specs', f), `src/specs/${f}`]),
  ...readdirSync(join(here, 'src/chat')).map((f) => [join(here, 'src/chat', f), `src/chat/${f}`]),
  [join(here, 'server/chat.ts'), 'server/chat.ts'],
];
if (!existsSync(join(app, 'tsconfig.server.json'))) files.push([join(here, 'templates/tsconfig.server.json'), 'tsconfig.server.json']);

for (const [from, to] of files) {
  mkdirSync(dirname(join(app, to)), { recursive: true });
  cpSync(from, join(app, to));
  console.log(to);
}
