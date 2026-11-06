// Picks how much of CI a pull request into main needs from the paths it changes, read one per line on stdin. The PR's
// base branch is the argument.
// 1: only Markdown the site doesn't render, so the build runs and Playwright doesn't.
// 2: only .ts files under tests/ that still exist, so the build runs and Playwright runs the specs they touch.
// 3: anything else, an empty list included, so everything runs. An unrecognized path always lands here, and so does
// every PR into another branch: retargeting a stacked PR to main runs no CI, so its last run has to have been full.
// `--self-test` checks the rules against known cases.
import { existsSync, readFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert';

// src/styles/globals.css keeps Tailwind from scanning what these two match, so a path added here is added there too.
const TEXT = /^(?:(?:README|CHANGELOG|CONTRIBUTING|CLAUDE)\.md|(?:docs|\.claude)\/.+\.md)$/;
const TEST = /^tests\/.+\.ts$/;

/**
 * @param {string[]} paths @param {string | undefined} base the PR's base branch
 * @param {(path: string) => boolean} exists @returns {1 | 2 | 3}
 */
export function tier(paths, base, exists = existsSync) {
  if (base !== 'main' || paths.length === 0) return 3;
  if (paths.every((path) => TEXT.test(path))) return 1;
  if (paths.every((path) => TEST.test(path) && exists(path))) return 2;
  return 3;
}

const CASES = [
  [[], 3],
  [['README.md'], 1],
  [['CHANGELOG.md', 'CONTRIBUTING.md', 'CLAUDE.md', 'docs/proposals/data-table.md', '.claude/skills/x/SKILL.md'], 1],
  [['docs/diagram.png'], 3],
  [['.claude/settings.json'], 3],
  [['registry/README.md'], 3],
  [['src/pages/docs/Overview.tsx'], 3],
  [['README.mdx'], 3],
  [['tests/inbox.spec.ts'], 2],
  [['tests/routes.ts', 'tests/inbox.spec.ts'], 2],
  [['tests/deleted.spec.ts'], 3],
  [['tests/data.json'], 3],
  [['tests/inbox.spec.ts', 'README.md'], 3],
  [['README.md', 'src/main.tsx'], 3],
  [['playwright.config.ts'], 3],
  [['.github/workflows/ci.yml'], 3],
  [['package-lock.json'], 3],
  [['README.md'], 3, 'ci-speed'],
  [['tests/inbox.spec.ts'], 3, 'ci-speed'],
  [['README.md'], 3, ''],
];

if (process.argv.includes('--self-test')) {
  const exists = (path) => path !== 'tests/deleted.spec.ts';
  for (const [paths, expected, base = 'main'] of CASES) {
    deepStrictEqual({ paths, base, tier: tier(paths, base, exists) }, { paths, base, tier: expected });
  }
  console.log(`ci-tier: ${CASES.length} cases pass`);
} else {
  console.log(tier(readFileSync(0, 'utf8').split('\n').filter(Boolean), process.argv[2]));
}
