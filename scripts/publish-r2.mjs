// Copies every file under <from-dir> to lede-design/<prefix>/<relative path> in R2.
//
//   node scripts/publish-r2.mjs <from-dir> <prefix> (--local | --remote) [--immutable]
//
// --local writes to the bucket `wrangler dev` simulates, through wrangler. --remote writes to Cloudflare through R2's
// S3 API, with an R2 API token's keys: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID, which names
// the endpoint (R2_ENDPOINT overrides it). That token can be limited to this one bucket, so the Cloudflare API token
// that deploys the Worker needs no R2 access. One of --local and --remote is required.
// --immutable refuses a prefix that already holds registry.json, so a release is never overwritten, and uploads
// registry.json last, so an interrupted publish can be retried. A prefix r/v<version> needs --immutable and must
// match package.json.
// Exit codes: 0 published, 1 failed, 2 usage, 3 the release already exists.
import { spawn } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import contentTypes from '../worker/content-types.json' with { type: 'json' };

const BUCKET = 'lede-design';
const MARKER = 'registry.json';
const MISSING = 'The specified key does not exist.';
const REGION = 'auto';
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

// Local: wrangler's simulated bucket. Each call answers { code, output }, as the remote calls below do.
const wrangler = (...rest) =>
  new Promise((done) => {
    const child = spawn(process.execPath, [WRANGLER, 'r2', 'object', ...rest, '--local'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (code) => done({ code, output }));
  });

// Remote: R2's S3 API, signed with AWS Signature Version 4. Keys are path style, <bucket>/<key>, as wrangler's are.
const remote = (() => {
  if (target !== '--remote') return null;
  const { R2_ACCESS_KEY_ID: id, R2_SECRET_ACCESS_KEY: secret, CLOUDFLARE_ACCOUNT_ID: account, R2_ENDPOINT } = process.env;
  const missing = Object.entries({ R2_ACCESS_KEY_ID: id, R2_SECRET_ACCESS_KEY: secret })
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (!R2_ENDPOINT && !account) missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (missing.length) fail(`--remote needs ${missing.join(', ')}: the keys of an R2 API token with Object Read & Write on ${BUCKET}`);
  return { id, secret, endpoint: new URL(R2_ENDPOINT || `https://${account}.r2.cloudflarestorage.com`) };
})();

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
// RFC 3986 encoding of each segment, which S3 signs; encodeURIComponent leaves !'()* as they are.
const encodeKey = (key) =>
  key
    .split('/')
    .map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join('/');

const s3 = async (method, key, { body = Buffer.alloc(0), headers = {} } = {}) => {
  const { id, secret, endpoint } = remote;
  const path = `${endpoint.pathname.replace(/\/$/, '')}/${encodeKey(key)}`;
  const stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
  const day = stamp.slice(0, 8);
  const signed = {
    ...Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value])),
    host: endpoint.host,
    'x-amz-content-sha256': sha256(body),
    'x-amz-date': stamp,
  };
  const names = Object.keys(signed).sort();
  const request = [method, path, '', ...names.map((name) => `${name}:${signed[name]}`), '', names.join(';'), signed['x-amz-content-sha256']].join('\n');
  const scope = `${day}/${REGION}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256(request)].join('\n');
  const key4 = ['s3', 'aws4_request'].reduce(hmac, hmac(hmac(`AWS4${secret}`, day), REGION));
  const authorization = `AWS4-HMAC-SHA256 Credential=${id}/${scope}, SignedHeaders=${names.join(';')}, Signature=${createHmac('sha256', key4).update(toSign).digest('hex')}`;
  const { host, ...sent } = signed;
  const url = new URL(path, endpoint);
  // Three tries for a dropped connection, a 429 or a 5xx, one and then two seconds apart; every other answer is final.
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { method, headers: { ...sent, authorization }, body: method === 'PUT' ? body : undefined });
      const text = method === 'HEAD' ? '' : await response.text();
      if ((response.status < 500 && response.status !== 429) || attempt === 3) return { status: response.status, output: `${method} ${key}: HTTP ${response.status} ${text}`.trim() };
    } catch (error) {
      if (attempt === 3) return { status: 0, output: `${method} ${key}: ${error.cause?.message ?? error.message}` };
    }
    await new Promise((wait) => setTimeout(wait, 1000 * attempt));
  }
};

// Whether a key exists: true, false, or the output that says why it couldn't tell.
const exists = async (key) => {
  if (!remote) {
    const { code, output } = await wrangler('get', key, '--pipe');
    return code === 0 ? true : output.includes(MISSING) ? false : output;
  }
  const { status, output } = await s3('HEAD', key);
  return status === 200 ? true : status === 404 ? false : output;
};

const upload = async (key, file, type) => {
  if (!remote) return wrangler('put', key, '--file', file, '--content-type', type);
  const { status, output } = await s3('PUT', key, {
    body: await readFile(file),
    headers: { 'content-type': type },
  });
  return { code: status === 200 ? 0 : 1, output };
};

if (immutable) {
  const marker = `${BUCKET}/${prefix}/${MARKER}`;
  const found = await exists(marker);
  if (found === true) fail(`${marker} already exists (${target.slice(2)}); a release is never overwritten`, 3);
  if (found !== false) fail(`couldn't tell whether ${marker} exists:\n${found.trim()}`);
}

const typeOf = (path) => {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return Object.hasOwn(contentTypes, extension) ? contentTypes[extension] : 'application/octet-stream';
};

const put = async (path) => {
  const key = `${BUCKET}/${prefix}/${path}`;
  const { code, output } = await upload(key, join(from, path), typeOf(path));
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
