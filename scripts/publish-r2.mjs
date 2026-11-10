// Copies every file under <from-dir> to lede-design/<prefix>/<relative path> in R2.
//
//   node scripts/publish-r2.mjs <from-dir> <prefix> (--local | --remote) [--immutable]
//
// --local writes to the bucket `wrangler dev` simulates; --remote writes to Cloudflare. One of them is required.
// --immutable refuses a prefix that already holds registry.json, so a release is never overwritten, and uploads
// registry.json last, so an interrupted publish can be retried. A prefix r/v<version> needs --immutable and must
// match package.json.
// Exit codes: 0 published, 1 failed, 2 usage, 3 the release already exists.
import { spawn } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import contentTypes from '../worker/content-types.json' with { type: 'json' };

const BUCKET = 'lede-design';
const MARKER = 'registry.json';
const MISSING = 'The specified key does not exist.';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WRANGLER = join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

const fail = (message, code = 1) => {
  console.error(`publish-r2: ${message}`);
  process.exit(code);
};

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const [fromArg, prefix, ...extra] = args.filter((arg) => !arg.startsWith('--'));
const unknown = [...flags].filter((flag) => !['--local', '--remote', '--immutable'].includes(flag));
const usage = 'usage: node scripts/publish-r2.mjs <from-dir> <prefix> (--local | --remote) [--immutable]';
if (!fromArg || !prefix || extra.length || unknown.length) fail(usage, 2);
if (flags.has('--local') === flags.has('--remote')) fail(`pass exactly one of --local and --remote\n${usage}`, 2);
if (!/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(prefix) || prefix.split('/').some((s) => s === '.' || s === '..')) {
  fail(`prefix "${prefix}" must be path segments of [A-Za-z0-9._-], with no leading or trailing slash`, 2);
}
const target = flags.has('--local') ? '--local' : '--remote';
// Local writes share one SQLite file, which reports SQLITE_BUSY under concurrent writers.
const concurrency = target === '--local' ? 1 : 4;
const immutable = flags.has('--immutable');

if (prefix.startsWith('r/v')) {
  if (!immutable) fail(`${prefix} is a release; publish it with --immutable so it can't overwrite one`, 2);
  const { version } = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  if (prefix !== `r/v${version}`) fail(`prefix ${prefix} doesn't match package.json version ${version} (expected r/v${version})`);
}

const from = resolve(fromArg);
if (!(await stat(from).catch(() => null))?.isDirectory()) fail(`${from} is not a directory`);
const files = (await readdir(from, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => relative(from, join(entry.parentPath, entry.name)).split(sep).join('/'))
  .sort();
if (!files.length) fail(`${from} has no files`);
if (immutable && !files.includes(MARKER)) fail(`--immutable needs ${MARKER} at the top of ${from}; it marks a release as published`);

const wrangler = (...rest) =>
  new Promise((done) => {
    const child = spawn(process.execPath, [WRANGLER, 'r2', 'object', ...rest, target], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (code) => done({ code, output }));
  });

if (immutable) {
  const marker = `${BUCKET}/${prefix}/${MARKER}`;
  const { code, output } = await wrangler('get', marker, '--pipe');
  if (code === 0) fail(`${marker} already exists (${target.slice(2)}); a release is never overwritten`, 3);
  if (!output.includes(MISSING)) fail(`couldn't tell whether ${marker} exists:\n${output.trim()}`);
}

const typeOf = (path) => {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return Object.hasOwn(contentTypes, extension) ? contentTypes[extension] : 'application/octet-stream';
};

const put = async (path) => {
  const key = `${BUCKET}/${prefix}/${path}`;
  const { code, output } = await wrangler('put', key, '--file', join(from, path), '--content-type', typeOf(path));
  if (code !== 0) throw new Error(`put ${key} failed:\n${output.trim()}`);
  console.log(`  ${key}`);
};

const pool = async (paths) => {
  const queue = [...paths];
  const errors = [];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length && !errors.length) await put(queue.shift()).catch((error) => errors.push(error));
    }),
  );
  if (errors.length) throw errors[0];
};

console.log(`publish-r2: ${files.length} files from ${fromArg} to ${BUCKET}/${prefix} (${target.slice(2)})`);
try {
  const last = immutable ? [MARKER] : [];
  await pool(files.filter((path) => !last.includes(path)));
  await pool(last);
} catch (error) {
  fail(error.message);
}
console.log(`publish-r2: done`);
