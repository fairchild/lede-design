// The publisher in scripts/publish-r2.mjs, run from a copy of the repo whose node_modules/wrangler is a stand-in. The
// stand-in logs each call and answers `get` for the release marker as the case says, so no case touches R2.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, expect } from '@playwright/test';

test.skip(({ isMobile }) => isMobile, 'No browser: one project is enough.');

const VERSION: string = JSON.parse(readFileSync('package.json', 'utf8')).version;

/** Answers `get` with the marker as MARKER says (here, missing or broken), records every call and succeeds on `put`. */
const STAND_IN = `
const { appendFileSync } = require('node:fs');
const [, , , , verb, key, ...rest] = process.argv;
appendFileSync(process.env.CALLS, JSON.stringify({ verb, key, rest }) + '\\n');
if (verb === 'get') {
  if (process.env.MARKER === 'here') { process.stdout.write('{}'); process.exit(0); }
  console.error(process.env.MARKER === 'missing' ? 'The specified key does not exist.' : 'Authentication error');
  process.exit(1);
}
`;

interface Call { verb: string; key: string; rest: string[] }

function publish(args: string[], { marker = 'missing', files = ['registry.json', 'button.json', 'list.json', 'a/b.svg', 'x.constructor'] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'publish-r2-'));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'node_modules/wrangler/bin'), { recursive: true });
  cpSync('scripts/publish-r2.mjs', join(root, 'scripts/publish-r2.mjs'));
  cpSync('worker', join(root, 'worker'), { recursive: true });
  cpSync('package.json', join(root, 'package.json'));
  writeFileSync(join(root, 'node_modules/wrangler/bin/wrangler.js'), STAND_IN);
  writeFileSync(join(root, 'node_modules/wrangler/package.json'), '{"type":"commonjs"}');
  for (const file of files) {
    mkdirSync(join(root, 'out', file, '..'), { recursive: true });
    writeFileSync(join(root, 'out', file), '{}');
  }
  const calls = join(root, 'calls.jsonl');
  writeFileSync(calls, '');
  const { status, stdout, stderr } = spawnSync(process.execPath, [resolve(root, 'scripts/publish-r2.mjs'), join(root, 'out'), ...args], {
    cwd: root, encoding: 'utf8', env: { ...process.env, CALLS: calls, MARKER: marker },
  });
  const log: Call[] = readFileSync(calls, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  rmSync(root, { recursive: true });
  return { status, output: stdout + stderr, calls: log, puts: log.filter(({ verb }) => verb === 'put').map(({ key }) => key) };
}

const release = `r/v${VERSION}`;

test('exits 3 and uploads nothing when the release is already published', () => {
  const { status, output, calls } = publish([release, '--remote', '--immutable'], { marker: 'here' });
  expect(status).toBe(3);
  expect(output).toContain(`lede-design/${release}/registry.json already exists (remote); a release is never overwritten`);
  expect(calls.map(({ verb }) => verb)).toEqual(['get']);
});

test('exits 1 and uploads nothing when it can\'t tell whether the release exists', () => {
  const { status, output, puts } = publish([release, '--remote', '--immutable'], { marker: 'broken' });
  expect(status).toBe(1);
  expect(output).toContain('Authentication error');
  expect(puts).toEqual([]);
});

test('uploads the marker last, after every other file, locally and with four at a time remotely', () => {
  for (const target of ['--local', '--remote']) {
    const { status, calls, puts } = publish([release, target, '--immutable']);
    expect(status, target).toBe(0);
    expect(calls[0], target).toMatchObject({ verb: 'get', key: `lede-design/${release}/registry.json` });
    expect(puts.at(-1), target).toBe(`lede-design/${release}/registry.json`);
    expect([...puts].sort(), target).toEqual(['registry.json', 'button.json', 'list.json', 'a/b.svg', 'x.constructor'].map((file) => `lede-design/${release}/${file}`).sort());
  }
});

test('types each upload by its own extension, and an inherited name as unknown', () => {
  const { calls } = publish(['media', '--local']);
  const types = Object.fromEntries(calls.map(({ key, rest }) => [key.split('/').at(-1), rest[rest.indexOf('--content-type') + 1]]));
  expect(types).toEqual({ 'registry.json': 'application/json; charset=utf-8', 'button.json': 'application/json; charset=utf-8', 'list.json': 'application/json; charset=utf-8', 'b.svg': 'image/svg+xml', 'x.constructor': 'application/octet-stream' });
});

test('holds an r/v prefix to --immutable and to package.json\'s version', () => {
  const loose = publish([release, '--remote']);
  expect(loose.status).toBe(2);
  expect(loose.output).toContain(`${release} is a release; publish it with --immutable`);
  const other = publish(['r/v9.9.9', '--remote', '--immutable']);
  expect(other.status).toBe(1);
  expect(other.output).toContain(`prefix r/v9.9.9 doesn't match package.json version ${VERSION}`);
  for (const result of [loose, other]) expect(result.calls).toEqual([]);
});

test('refuses a prefix that climbs or has an empty segment, and needs exactly one target', () => {
  for (const args of [['r/../media', '--local'], ['/r/next', '--local'], ['r//next', '--local'], ['r/next'], ['r/next', '--local', '--remote']]) {
    const { status, calls } = publish(args);
    expect(status, args.join(' ')).toBe(2);
    expect(calls, args.join(' ')).toEqual([]);
  }
});
