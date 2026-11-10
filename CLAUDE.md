# Lede — working in this repo

Lede is a design system: Base UI primitives, semantic HTML, tokens as shadcn variables, shipped as a shadcn
registry, with layouts (blocks) and hero flows. The docs site and demo app are the test bed.

Read `CONTRIBUTING.md` before a non-trivial change. It holds the layers, the rules, the Writing section and what a pull
request needs, and this file doesn't repeat them. What follows is what an agent needs on top: the commands and how CI
picks what to run.

## Commands
- `npm run dev` — site at http://localhost:5173
- `npm run build` — tokens → registry → typecheck → site (`dist/`, includes `dist/r/`)
- `npm test` — Playwright + axe on every route, in light, dark, light-hc and dark-hc on desktop and in light and
  dark-hc on a phone (run `npm run build` first).
  It builds and serves its own copy, `dist-fixtures/`, with the `/fixtures/*` test pages, and a second on the next
  port, `dist-strict/`, with React's development build, where the `strict-desktop` project runs the focus specs under
  StrictMode, and the swipe rows with the phone's viewport and touch. `npm run dev` has the fixture pages too; `dist/` leaves them out.
  First run: `npx playwright install chromium`. To use a Chromium you already have: `PW_CHROMIUM=/path/to/chrome npm test`.
  To run beside another server, use a free port of your own: `PW_PORT=4571 npm test`. Tests default to port 4300, away
  from `npm run preview` (4173), because outside CI they reuse whatever server is on their port; a first check fails
  if that server has no fixture pages.
- `npm run contrast` — the contrast gate alone; `npm run contrast -- --report` prints every pair.
- CI runs what a PR into main can affect, and `check` is the one status to read. `scripts/ci-tier.mjs` sorts the
  PR's diff against main. A diff of only Markdown the site doesn't render (the root `CHANGELOG.md`, `CONTRIBUTING.md`
  and `CLAUDE.md`, plus Markdown in `docs/` and `.claude/`) runs the build. Overview renders the README's install steps,
  so a README diff runs everything. A diff of only `.ts`
  files under `tests/`, none of them deleted, runs the build and the specs that change or import a changed helper. Any
  other diff runs the build and the whole suite in shards, with `perf` on a runner of its own. A PR into another
  branch, a push to main and a manual run always run everything. The `@source not` lines in `src/styles/globals.css`
  keep Tailwind from scanning those Markdown files and `tests/`, so neither kind of diff reaches the site's CSS, and
  they change with the script's lists. If the site starts to render one of those Markdown files, take it out of both.
