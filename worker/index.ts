import contentTypes from './content-types.json';

// A key is the path without its leading slash. R2 keys are at most 1024 bytes, and these patterns admit only ASCII, so a
// lookahead on the path's length keeps every key valid. A release item's marker, <dir>/registry.json, is at most 7 bytes
// longer than the item's key (when the name is one character), so RELEASE stops at 1018 and MEDIA at 1025.
// /r/v<semver>/<name>.json is a release and never changes; /r/next/<name>.json follows main.
const RELEASE = /^(?=.{1,1018}$)\/r\/(v\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?|next)\/[a-z0-9-]+\.json$/;
const LATEST = /^\/r\/[a-z0-9-]+\.json$/;
// The URL parser resolves . and .. segments (and %2e forms) before routing, so a key can't climb out of its prefix.
const MEDIA = /^(?=.{1,1025}$)\/media\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

type Kind = 'release' | 'next' | 'media';

const CACHE: Record<Kind, string> = {
  release: 'public, max-age=31536000, immutable',
  next: 'public, max-age=60, must-revalidate',
  media: 'public, max-age=86400',
};

const JSON_TYPE = contentTypes.json;

export default {
  async fetch(request, env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return plain(405, 'Method not allowed', { allow: 'GET, HEAD' });
    }
    const { pathname } = new URL(request.url);
    const release = RELEASE.exec(pathname);
    if (release) return fromBucket(request, env, pathname.slice(1), release[1] === 'next' ? 'next' : 'release');
    if (pathname.startsWith('/r/')) return LATEST.test(pathname) ? fromAssets(request, env) : notFound();
    if (pathname.startsWith('/media/')) {
      return MEDIA.test(pathname) ? fromBucket(request, env, pathname.slice(1), 'media') : notFound();
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

// A release is readable once its registry.json exists. The publisher writes it last and refuses the release from then
// on, so an item read after the marker is seen is final. The marker is read first: an item read alongside it could
// capture bytes that a retry replaces before the marker appears, and serve them as immutable.
async function fromBucket(request: Request, env: Env, key: string, kind: Kind): Promise<Response> {
  const marker = kind === 'release' && !key.endsWith('/registry.json') ? key.replace(/[^/]+$/, 'registry.json') : null;
  let object: R2ObjectBody | null;
  try {
    if (marker && !(await env.BUCKET.head(marker))) return notFound();
    object = await env.BUCKET.get(key);
  } catch (error) {
    // The patterns already keep keys valid, so this is R2 failing. A 404 would tell shadcn the item doesn't exist.
    console.error(error);
    return plain(503, 'Storage unavailable', { 'retry-after': '30' });
  }
  if (!object) return notFound();
  const headers = new Headers({
    'cache-control': CACHE[kind],
    'content-type': kind === 'media' ? (object.httpMetadata?.contentType ?? typeOf(key)) : JSON_TYPE,
    etag: object.httpEtag,
    'last-modified': object.uploaded.toUTCString(),
    'x-content-type-options': 'nosniff',
  });
  if (kind !== 'media') headers.set('access-control-allow-origin', '*');
  return respond(request, object.body, headers, httpDate(headers.get('last-modified')));
}

// /r/<name>.json is the deployed build's own dist/r, the latest release once deploys come from tags. A missing file
// comes back as the SPA shell, so the asset is fetched without the request's conditional headers, anything that isn't
// JSON is a 404, and preconditions are evaluated here against the JSON's own ETag.
async function fromAssets(request: Request, env: Env): Promise<Response> {
  const asset = await env.ASSETS.fetch(request.url, { method: request.method });
  if (!asset.headers.get('content-type')?.startsWith('application/json')) {
    await asset.body?.cancel();
    return notFound();
  }
  const headers = new Headers(asset.headers);
  headers.set('access-control-allow-origin', '*');
  headers.set('content-type', JSON_TYPE);
  headers.set('x-content-type-options', 'nosniff');
  return respond(request, asset.body, headers, httpDate(asset.headers.get('last-modified')));
}

// RFC 9110 §13.2.2, in order: If-Match, else If-Unmodified-Since, fails with 412; then If-None-Match, else
// If-Modified-Since, answers 304. Dates compare in whole seconds, as HTTP dates carry them.
async function respond(
  request: Request,
  body: ReadableStream | null,
  headers: Headers,
  modified: number | null,
): Promise<Response> {
  const h = request.headers;
  const etag = headers.get('etag');
  const ifMatch = h.get('if-match');
  const unmodifiedSince = httpDate(h.get('if-unmodified-since'));
  const ifNoneMatch = h.get('if-none-match');
  const modifiedSince = httpDate(h.get('if-modified-since'));
  const failed =
    ifMatch !== null
      ? !matches(ifMatch, etag, true)
      : unmodifiedSince !== null && modified !== null && modified > unmodifiedSince;
  const notModified =
    ifNoneMatch !== null
      ? matches(ifNoneMatch, etag, false)
      : modifiedSince !== null && modified !== null && modified <= modifiedSince;
  if (!failed && !notModified) return new Response(body, { headers });
  await body?.cancel();
  return failed ? plain(412, 'Precondition failed') : new Response(null, { status: 304, headers });
}

// Strong comparison (If-Match) never matches a weak tag; weak comparison (If-None-Match) ignores W/.
const matches = (header: string, etag: string | null, strong: boolean): boolean => {
  if (header.trim() === '*') return true;
  if (etag === null) return false;
  const weak = (tag: string) => tag.replace(/^W\//, '');
  return header
    .split(',')
    .map((tag) => tag.trim())
    .some((tag) => (strong ? tag === etag && !tag.startsWith('W/') : weak(tag) === weak(etag)));
};

const httpDate = (value: string | null): number | null => {
  const time = value === null ? NaN : Date.parse(value);
  return Number.isNaN(time) ? null : Math.floor(time / 1000);
};

const typeOf = (key: string): string =>
  (contentTypes as Record<string, string>)[key.slice(key.lastIndexOf('.') + 1).toLowerCase()] ??
  'application/octet-stream';

// no-store: a release that isn't published yet must not stay missing in a cache once it is.
const notFound = (): Response => plain(404, 'Not found');

const plain = (status: number, body: string, extra: Record<string, string> = {}): Response =>
  new Response(`${body}\n`, {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff',
      ...extra,
    },
  });
