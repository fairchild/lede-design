// Picks how much of CI a pull request into main needs from the paths it changes, read one per line on stdin. The PR's
// base branch is the argument.
// 1: only Markdown the site doesn't render, integrations/ files and the design system's templates in
// scripts/design-system/ that still exist, so the build runs and Playwright doesn't. Nothing the site builds imports
// integrations/ or reads scripts/design-system/, and the integrations job runs each entry's own build and tests on
// every PR. A deleted one isn't tier 1: the Decisions page links paths there, and layouts.spec checks they exist.
// 2: only .ts files under tests/ that still exist, so the build runs and Playwright runs the specs they touch.
// 3: anything else, an empty list included, so everything runs. An unrecognized path always lands here, and so does
// every PR into another branch: retargeting a stacked PR to main runs no CI, so its last run has to have been full.
// `--self-test` checks the rules against known cases.
import { existsSync, readFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert';

// src/styles/globals.css keeps Tailwind from scanning what these match, so a path added here is added there too.
const TEXT = /^(?:(?:CHANGELOG|CONTRIBUTING|CLAUDE)\.md|(?:docs|\.claude)\/.+\.md)$/;
const INTEGRATION = /^(?:integrations|scripts\/design-system)\/.+/;
const TEST = /^tests\/.+\.ts$/;

/**
 * @param {string[]} paths @param {string | undefined} base the PR's base branch
 * @param {(path: string) => boolean} exists @returns {1 | 2 | 3}
 */
export function tier(paths, base, exists = existsSync) {
  if (base !== 'main' || paths.length === 0) return 3;
  if (paths.every((path) => TEXT.test(path) || (INTEGRATION.test(path) && exists(path)))) return 1;
  if (paths.every((path) => TEST.test(path) && exists(path))) return 2;
  return 3;
}

const CASES = [
  [[], 3],
  // Overview renders the README's install steps.
  [['README.md'], 3],
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
  [['tests/inbox.spec.ts', 'CHANGELOG.md'], 3],
  [['CHANGELOG.md', 'src/main.tsx'], 3],
  [['playwright.config.ts'], 3],
  [['.github/workflows/ci.yml'], 3],
  [['package-lock.json'], 3],
  [['CHANGELOG.md'], 3, 'ci-speed'],
  [['integrations/README.md', 'integrations/json-render/src/App.tsx', 'integrations/json-render/package-lock.json'], 1],
  [['integrations/json-render/specs/inbox.json', 'CHANGELOG.md'], 1],
  [['integrations'], 3],
  [['scripts/design-system/README.md', 'scripts/design-system/cover.html', 'CHANGELOG.md'], 1],
  [['scripts/design-system/deleted.html'], 3],
  [['scripts/build-design-system.mjs'], 3],
  [['integrations/json-render/tests/deleted.test.tsx'], 3],
  [['integrations/json-render/src/App.tsx', 'integrations/json-render/tests/deleted.test.tsx'], 3],
  [['integrations/json-render/src/App.tsx', 'src/main.tsx'], 3],
  [['integrations/json-render/src/App.tsx', 'registry/lede/list.tsx'], 3],
  [['integrations/json-render/tests/specs.test.tsx', 'tests/inbox.spec.ts'], 3],
  [['tests/inbox.spec.ts'], 3, 'ci-speed'],
  [['integrations/json-render/src/App.tsx'], 3, 'ci-speed'],
  [['CHANGELOG.md'], 3, ''],
];

if (process.argv.includes('--self-test')) {
  const exists = (path) => !path.includes('/deleted.');
  for (const [paths, expected, base = 'main'] of CASES) {
    deepStrictEqual({ paths, base, tier: tier(paths, base, exists) }, { paths, base, tier: expected });
  }
  console.log(`ci-tier: ${CASES.length} cases pass`);
} else {
  console.log(tier(readFileSync(0, 'utf8').split('\n').filter(Boolean), process.argv[2]));
}
