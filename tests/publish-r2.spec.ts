// The publisher in scripts/publish-r2.mjs, run from a copy of the repo. --local goes to a stand-in for wrangler in its
// node_modules, and --remote to a stand-in for R2's S3 API on a local port (R2_ENDPOINT). Each logs every call and
// answers for the release marker as the case says, so no case touches R2.
import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
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

interface Call { verb: string; key: string; rest: string[]; authorization?: string }

/** Answers HEAD for the marker as MARKER says (200 here, 404 missing, 403 broken), records every call and takes PUT. */
async function s3StandIn(marker: string, calls: Call[]) {
  const server = createServer((request, response) => {
    const key = decodeURIComponent(new URL(request.url!, 'http://stand-in').pathname.slice(1));
    const verb = request.method === 'HEAD' ? 'get' : request.method!.toLowerCase();
    calls.push({ verb, key, rest: ['--content-type', String(request.headers['content-type'])], authorization: request.headers.authorization });
    request.resume().on('end', () => {
      response.statusCode = verb === 'put' ? 200 : { here: 200, missing: 404 }[marker] ?? 403;
      response.end();
    });
  });
  await new Promise<void>((listening) => server.listen(0, '127.0.0.1', listening));
  return { server, endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

const KEYS = { R2_ACCESS_KEY_ID: 'stand-in-id', R2_SECRET_ACCESS_KEY: 'stand-in-secret' };

async function publish(args: string[], { marker = 'missing', keys = KEYS as Record<string, string>, endpointSet = true, files = ['registry.json', 'button.json', 'list.json', 'a/b.svg', 'x.constructor'] } = {}) {
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
  const remote: Call[] = [];
  const { server, endpoint } = await s3StandIn(marker, remote);
  // The keys option is the whole credential set: R2 keys or an account ID it leaves out are unset, whatever the shell has.
  const env: Record<string, string | undefined> = { ...process.env, CALLS: calls, MARKER: marker, R2_ENDPOINT: endpoint };
  for (const name of [...Object.keys(KEYS), 'CLOUDFLARE_ACCOUNT_ID']) delete env[name];
  Object.assign(env, keys);
  if (!endpointSet) delete env.R2_ENDPOINT;
  let status: number | null, stdout = '', stderr = '', log: Call[];
  try {
    // Asynchronous, so the stand-in in this process can answer while the script runs.
    status = await new Promise<number | null>((done, failed) => {
      const child = spawn(process.execPath, [resolve(root, 'scripts/publish-r2.mjs'), join(root, 'out'), ...args], { cwd: root, env });
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.stderr.on('data', (chunk) => (stderr += chunk));
      child.on('error', failed);
      child.on('close', done);
    });
    log = [...readFileSync(calls, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)), ...remote];
  } finally {
    server.close();
    rmSync(root, { recursive: true });
  }
  return { status, output: stdout + stderr, calls: log, puts: log.filter(({ verb }) => verb === 'put').map(({ key }) => key) };
}

const release = `r/v${VERSION}`;

test('exits 3 and uploads nothing when the release is already published', async () => {
  const { status, output, calls } = await publish([release, '--remote', '--immutable'], { marker: 'here' });
  expect(status).toBe(3);
  expect(output).toContain(`lede-design/${release}/registry.json already exists (remote); a release is never overwritten`);
  expect(calls.map(({ verb }) => verb)).toEqual(['get']);
});

test('exits 1 and uploads nothing when it can\'t tell whether the release exists', async () => {
  for (const target of ['--local', '--remote']) {
    const { status, output, puts } = await publish([release, target, '--immutable'], { marker: 'broken' });
    expect(status, target).toBe(1);
    expect(output, target).toContain(target === '--local' ? 'Authentication error' : 'HTTP 403');
    expect(puts, target).toEqual([]);
  }
});

test('needs an R2 token\'s keys to publish remotely, and signs every call with them', async () => {
  const bare = await publish(['r/next', '--remote'], { keys: {} });
  expect(bare.status).toBe(1);
  expect(bare.output).toContain('--remote needs R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
  expect(bare.calls).toEqual([]);
  const nowhere = await publish(['r/next', '--remote'], { endpointSet: false });
  expect(nowhere.status).toBe(1);
  expect(nowhere.output).toContain('--remote needs CLOUDFLARE_ACCOUNT_ID');
  const { status, calls } = await publish(['r/next', '--remote']);
  expect(status).toBe(0);
  expect(calls).toHaveLength(5);
  for (const { authorization } of calls) expect(authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=stand-in-id\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
});

test('uploads the marker last, after every other file, locally and with four at a time remotely', async () => {
  for (const target of ['--local', '--remote']) {
    const { status, calls, puts } = await publish([release, target, '--immutable']);
    expect(status, target).toBe(0);
    expect(calls[0], target).toMatchObject({ verb: 'get', key: `lede-design/${release}/registry.json` });
    expect(puts.at(-1), target).toBe(`lede-design/${release}/registry.json`);
    expect([...puts].sort(), target).toEqual(['registry.json', 'button.json', 'list.json', 'a/b.svg', 'x.constructor'].map((file) => `lede-design/${release}/${file}`).sort());
  }
});

test('types each upload by its own extension, and an inherited name as unknown', async () => {
  for (const target of ['--local', '--remote']) {
    const { calls } = await publish(['media', target]);
    const types = Object.fromEntries(calls.map(({ key, rest }) => [key.split('/').at(-1), rest[rest.indexOf('--content-type') + 1]]));
    expect(types, target).toEqual({ 'registry.json': 'application/json; charset=utf-8', 'button.json': 'application/json; charset=utf-8', 'list.json': 'application/json; charset=utf-8', 'b.svg': 'image/svg+xml', 'x.constructor': 'application/octet-stream' });
  }
});

test('holds an r/v prefix to --immutable and to package.json\'s version', async () => {
  const loose = await publish([release, '--remote']);
  expect(loose.status).toBe(2);
  expect(loose.output).toContain(`${release} is a release; publish it with --immutable`);
  const other = await publish(['r/v9.9.9', '--remote', '--immutable']);
  expect(other.status).toBe(1);
  expect(other.output).toContain(`prefix r/v9.9.9 doesn't match package.json version ${VERSION}`);
  for (const result of [loose, other]) expect(result.calls).toEqual([]);
});

test('refuses a prefix that climbs or has an empty segment, and needs exactly one target', async () => {
  for (const args of [['r/../media', '--local'], ['/r/next', '--local'], ['r//next', '--local'], ['r/next'], ['r/next', '--local', '--remote']]) {
    const { status, calls } = await publish(args);
    expect(status, args.join(' ')).toBe(2);
    expect(calls, args.join(' ')).toEqual([]);
  }
});
