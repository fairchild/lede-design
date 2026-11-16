import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// The README writes the release into its registry URLs by hand: step 1's command and the components.json example. Each
// has to name this release, so a version bump that misses one fails here.
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

test('every registry URL in the README pins this release', () => {
  const urls = readFileSync('README.md', 'utf8').match(/https:\/\/lede\.cloudcompute\.com\/r\/[^\s'"]+/g) ?? [];
  expect(urls.length).toBeGreaterThanOrEqual(2);
  for (const url of urls) expect(url).toBe(`https://lede.cloudcompute.com/r/v${version}/{name}.json`);
});

test('the README’s components.json is valid JSON with Lede’s registry', () => {
  const block = readFileSync('README.md', 'utf8').split(/^## components\.json$/m)[1]?.match(/```json\n([\s\S]*?)\n```/)?.[1];
  expect(block, 'a json block under “## components.json”').toBeTruthy();
  const config = JSON.parse(block!);
  expect(config.registries['@lede']).toBe(`https://lede.cloudcompute.com/r/v${version}/{name}.json`);
  expect(config.rsc).toBe(false);
});
