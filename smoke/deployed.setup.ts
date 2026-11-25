import { createHash } from 'node:crypto';
import { test as setup, expect, type APIRequestContext } from '@playwright/test';

// A new Worker version reaches the edge within seconds, but not at once. Until the site serves the files this build
// made, the checks would read the previous deploy, so they wait for it here, once. The entry script's name changes
// only with the JavaScript, so a docs- or registry-only change is told apart by the two files' hashes.
const sha256 = async (request: APIRequestContext, path: string) =>
  createHash('sha256').update(await (await request.get(path, { headers: { 'cache-control': 'no-cache' }, failOnStatusCode: false })).body()).digest('hex');

setup('the site serves this build', async ({ request, baseURL }) => {
  const { SMOKE_ENTRY: entry, SMOKE_REGISTRY_SHA256: registry, SMOKE_LLMS_SHA256: llms } = process.env;
  setup.skip(!entry && !registry && !llms, 'Nothing names a build (SMOKE_ENTRY and the hashes), so the checks read whatever is live.');
  setup.setTimeout(240_000);
  await expect
    .poll(
      async () => {
        const stale: string[] = [];
        if (entry) {
          const shell = await request.get('/', { headers: { 'cache-control': 'no-cache' }, failOnStatusCode: false });
          if (!(await shell.text()).includes(`src="${entry}"`)) stale.push(`/ doesn't name ${entry}`);
        }
        if (registry && (await sha256(request, '/r/registry.json')) !== registry) stale.push('/r/registry.json differs');
        if (llms && (await sha256(request, '/llms.txt')) !== llms) stale.push('/llms.txt differs');
        return stale;
      },
      { message: `${baseURL} never served this build`, timeout: 210_000, intervals: [5_000] },
    )
    .toEqual([]);
});
