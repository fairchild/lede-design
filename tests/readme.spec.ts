import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// The README writes the release into its registry URLs by hand: step 1's command, the components.json example and the
// GitHub mirror. Each has to name this release, so a version bump that misses one fails here.
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

test('every registry URL in the README pins this release', () => {
  const readme = readFileSync('README.md', 'utf8');
  const urls = readme.match(/https:\/\/lede\.cloudcompute\.com\/r\/[^\s'"`]+/g) ?? [];
  expect(urls.length).toBeGreaterThanOrEqual(2);
  for (const url of urls) expect(url).toBe(`https://lede.cloudcompute.com/r/v${version}/{name}.json`);
  const mirrors = readme.match(/https:\/\/raw\.githubusercontent\.com\/fairchild\/lede-design\/registry\/[^\s'"`]+/g) ?? [];
  expect(mirrors.length).toBeGreaterThanOrEqual(1);
  for (const url of mirrors) expect(url).toBe(`https://raw.githubusercontent.com/fairchild/lede-design/registry/r/v${version}/{name}.json`);
});

test('the README’s components.json is valid JSON with Lede’s registry', () => {
  const block = readFileSync('README.md', 'utf8').split(/^## components\.json$/m)[1]?.match(/```json\n([\s\S]*?)\n```/)?.[1];
  expect(block, 'a json block under “## components.json”').toBeTruthy();
  const config = JSON.parse(block!);
  expect(config.registries['@lede']).toBe(`https://lede.cloudcompute.com/r/v${version}/{name}.json`);
  expect(config.rsc).toBe(false);
});

test('the README’s skill install and llms.txt’s skill link pin this release’s tag, not main', () => {
  const skill = (text: string) => text.match(/https:\/\/raw\.githubusercontent\.com\/fairchild\/lede-design\/[^/\s]+\/\.claude\/skills\/lede-design-system\/SKILL\.md/g) ?? [];
  const pinned = `https://raw.githubusercontent.com/fairchild/lede-design/v${version}/.claude/skills/lede-design-system/SKILL.md`;
  expect(skill(readFileSync('README.md', 'utf8'))).toEqual([pinned]);
  expect(skill(readFileSync('scripts/llms/llms.md', 'utf8').replaceAll('{{VERSION}}', version))).toEqual([pinned]);
});
