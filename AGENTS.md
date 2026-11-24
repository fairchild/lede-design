# Lede — working in this repo

This file is for coding agents of any kind. `CLAUDE.md` imports it, so Claude Code reads the same text.

Lede is a design system: Base UI primitives, semantic HTML, tokens as shadcn variables, shipped as a shadcn
registry, with layouts (blocks) and hero flows. The docs site and demo app are the test bed.

Read `CONTRIBUTING.md` before a non-trivial change. It holds the layers, the rules, the Writing section and what a pull
request needs, and this file doesn't repeat them. What follows is what an agent needs on top: the commands and how CI
picks what to run.

## Commands
- `npm run dev` — site at http://localhost:5173
- `npm run build` — tokens → registry (each item's JSON gains its reference page, from `scripts/llms/registry-docs.mjs`) →
  typecheck → site (`dist/`, includes `dist/r/`, and from `scripts/llms/` each
  docs page's `.md`, `dist/reference/`, the Open Knowledge Format indexes `index.md` and `reference/index.md`,
  `llms.txt` and `llms-full.txt`, which `npm run dev` serves too)
- `npm test` — Playwright + axe on every route, in light, dark, light-hc and dark-hc on desktop and in light and
  dark-hc on a phone (run `npm run build` first).
  It builds and serves its own copy, `dist-fixtures/`, with the `/fixtures/*` test pages, and a second on the next
  port, `dist-strict/`, with React's development build, where the `strict-desktop` project runs the focus specs under
  StrictMode, and the swipe rows with the phone's viewport and touch. `npm run dev` has the fixture pages too; `dist/` leaves them out.
  First run: `npx playwright install chromium`. To use a Chromium you already have: `PW_CHROMIUM=/path/to/chrome npm test`.
  To run beside another server, use a free port of your own: `PW_PORT=4571 npm test`. Tests default to port 4300, away
  from `npm run preview` (4173), because outside CI they reuse whatever server is on their port; a first check fails
  if that server has no fixture pages.
- `node benchmarks/docs-agent/run.mjs` — the docs benchmark: a fresh agent builds a screen from `llms.txt` alone, and
  the harness records what it read and checks what it built. It spends money, so nothing runs it automatically.
  `benchmarks/docs-agent/README.md` covers options and fairness.
- `SMOKE_URL=https://lede-preview.cloudcompute.com npx playwright test -c playwright.smoke.config.ts` — the smoke
  tests in `smoke/`, which read a deployed site: key pages render, every registry item and the llms files are served,
  and the Worker's 404s and Markdown answers hold. `deploy-preview.yml` runs them after each deploy to develop, against
  the build it just made, and *Approve the release* waits for them to pass on the release's commit. The preview run
  also records screenshots of key pages (`SMOKE_SCREENSHOTS=record`), and `deploy.yml` runs the same tests on production
  after a release and compares its pages with them (`compare`).
- `npm run contrast` — the contrast gate alone; `npm run contrast -- --report` prints every pair.
- `scripts/preview-pr.sh <N>` — builds pull request N and uploads it as the Worker Preview `pr-<N>` (`--dry-run`,
  `--comment`, `--delete`). `CONTRIBUTING.md` covers credentials.
- Branches: open pull requests into `develop`; `main` changes only at a release. Releasing is in `docs/releasing.md`.
  Only a repo admin or the release app can create the `vX.Y.Z` tag that deploys the site. Start a release with the
  *Prepare a release* workflow (or `scripts/prepare-release.mjs`); Michael approves it in the `release` environment,
  and the workflows merge, tag and deploy.
- `npm run design-system` — writes Lede's design system for claude.ai to `dist-design-system/project/`.
  CONTRIBUTING.md says how to publish it.
- CI runs what a PR into main can affect, and `check` is the one status to read. `scripts/ci-tier.mjs` sorts the PR's
  diff against main. A diff of only Markdown the site doesn't render (the root `CHANGELOG.md`, `CONTRIBUTING.md`,
  `AGENTS.md` and `CLAUDE.md`, plus Markdown in `docs/` and `.claude/`), of files under `integrations/`, `benchmarks/`
  or `scripts/design-system/` that still exist, or of these together, runs the build. Overview renders the README's
  install steps, so a README diff runs everything. A diff of only `.ts` files under `tests/`, none of them deleted,
  runs the build and the specs that change or import a changed helper. Any other diff runs the build and the whole
  suite in shards, with `perf` on a runner of its own. A PR into another branch, a push to main and a manual run
  always run everything. The `integrations` job, which `check` needs, runs each `integrations/` entry's own build and
  tests on every PR. The `@source not` lines in `src/styles/globals.css` keep Tailwind from scanning those Markdown
  files, `tests/`, `integrations/`, `benchmarks/` and `scripts/design-system/`, so none of those diffs reaches the
  site's CSS, and they change with the script's lists. If the site starts to render one of those Markdown files, take
  it out of both. One more, `scripts/llms/`, keeps the Markdown generator's selector strings out of the CSS; it stays
  out of the script's lists, since its diffs change the built Markdown. So does `smoke/`, the deployed-site checks above,
  which CI doesn't run: a diff there runs everything.
