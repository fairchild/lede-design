#!/usr/bin/env node
// Prepares a release on the current branch: step 1 of docs/releasing.md, without the commit.
//
//   node scripts/prepare-release.mjs 0.8.0 "What the release is about, in a sentence or two."
//
// It sets the version in package.json and package-lock.json, moves every `v<old>` URL in the README, integrations/
// and .github/ to `v<new>`, and renames CHANGELOG.md's `## Unreleased` to `## <new>` with the summary and the
// release's registry URL under it. The Prepare a release workflow runs it; a person or an agent can run it too.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const [next, summary] = process.argv.slice(2)
const fail = (message) => {
  console.error(`prepare-release: ${message}`)
  process.exit(1)
}

const semver = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/
if (!next || !semver.test(next)) fail('give the new version, such as 0.8.0, as the first argument.')
if (!summary?.trim()) fail("give a summary of the release as the second argument; it goes under the CHANGELOG heading.")

const current = JSON.parse(readFileSync('package.json', 'utf8')).version
const parts = (v) => v.match(semver).slice(1, 4).map(Number)
const compare = (a, b) => {
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]
  return 0
}
if (compare(next, current) <= 0) fail(`${next} isn't above the current version, ${current}.`)

const changelog = readFileSync('CHANGELOG.md', 'utf8')
if (!/^## Unreleased$/m.test(changelog)) fail("CHANGELOG.md has no `## Unreleased` section to name the release.")

execFileSync('npm', ['version', next, '--no-git-tag-version'], { stdio: 'inherit' })

const from = `v${current}`
const to = `v${next}`
let urls = ''
try {
  urls = execFileSync('git', ['grep', '-lF', from, '--', 'README.md', 'integrations', '.github'], { encoding: 'utf8' })
} catch (error) {
  if (error.status !== 1) throw error // 1 means no match
}
for (const file of urls.split('\n').filter(Boolean)) {
  writeFileSync(file, readFileSync(file, 'utf8').replaceAll(from, to))
  console.log(`${file}: ${from} → ${to}`)
}

const registry = `\`https://lede.cloudcompute.com/r/${to}/{name}.json\``
writeFileSync(
  'CHANGELOG.md',
  changelog.replace(/^## Unreleased$/m, `## ${next}\n\n${summary.trim()} The registry for this release is ${registry}.`),
)
console.log(`CHANGELOG.md: ## Unreleased → ## ${next}`)
