# Lede — working in this repo

Lede is a design system: Base UI primitives, semantic HTML, tokens as shadcn variables, shipped as a shadcn
registry, with layouts (blocks) and hero flows. The docs site and demo app are the test bed.

## Layers (dependencies only point down)
1. `tokens/tokens.json` — the single source for color (4 themes), type, weight, spacing, radius, stroke, shadow, blur,
   size, layout, opacity, motion, layers and breakpoints. `npm run tokens`
   writes `src/styles/lede.tokens.css` and `registry/lede/lede.tokens.css` (generated, git-ignored).
2. `registry/lede/*.tsx` — primitives. `lede.components.css` styles them.
3. `registry/lede/blocks/*.tsx` — layouts and higher-level components. `lede.blocks.css`.
   `registry/lede/json-render/` sits here too: a json-render catalog and registry over the components, adding no CSS.
4. `registry/lede/flows/*.tsx` — hero-flow assemblies. Router-agnostic: data, hrefs and callbacks in; no fetching.
5. `src/` — docs site and the demo app ("Daybook"), wiring flows to React Router and sample data.
- `integrations/` sits outside the layers: self-contained apps that show Lede beside another project. They read `registry/`, and no layer imports them.

Registry files use relative imports (`../list`) that match their install targets (`components/lede/…`).
Every installed registry file must be listed in `registry.json`; the `index.ts` barrels are repo-only and don't install.
`npm run registry` checks that each item's relative imports resolve, then builds `public/r/*.json`.

## Rules
- **Semantic HTML first.** Native element if one exists (`<button>`, `<a href>`, `<fieldset>`, `<nav>`, `<section>` +
  heading, `<ul>`). Base UI only when HTML can't do the interaction. ARIA only for what HTML can't express.
  Never `div role="button"`; navigation is a link, an action is a button; no interactive nesting.
- **One h1 per screen** (PageHeader), focused on navigation. Regions are named. Headings don't skip levels.
- **Focus.** Focus lands where the person acts next: the h1 to read, the first field that needs input to type and the
  primary button to confirm. Enter acts and Escape backs out one layer per press. Back and back links return to where
  the person was. Each change moves focus once, in the same task, so `<body>` never shows; an announcement follows it.
  `tests/focus-table.ts` is the source of truth. Its `test.fixme` rows mark what isn't built yet and name the PR that
  builds it. A PR that adds a screen or an action adds its rows there.
- **Progressive disclosure.** Every screen, section and row leads with its takeaway (`summary`). Quiet affordances,
  revealed at the point of use. Expert paths (swipe) always have a visible twin.
- **Tokens only.** No raw colors or radii in components; use shadcn names (`--primary`, `--muted-foreground`) or
  Lede extras. Text on a tint uses `--ld-primary-on-tint`. Radii derive from `--radius` and `--radius-step` (concentric).
  `npm run literals`, part of the build, fails on a number or color in registry CSS that comes from no token, unless
  `tokens/literal-exceptions.json` lists it with a reason.
- **Prefixes.** Component classes start `ld-`, and component-level custom properties start `--ld-`. Tokens from
  `tokens/tokens.json` keep their plain names (`--primary`, `--fill-control`, `--space-4`), type classes are `text-*`,
  and docs-site helpers start `docs-`. Two letters keep stacked class lists short. The cost is that the prefix also
  sits inside `field-` and `build-`, so match it with `(?<![\w-])(--)?ld-`, never as a bare substring.
- **Names.** A heading prop is `title`. A value callback is named for its controlled prop: `value` → `onValueChange`,
  `checked` → `onCheckedChange`, `open` → `onOpenChange`. A wrapper that passes native input props through keeps the
  DOM's `onChange`. Color that carries meaning is a `tone` declared with `ToneSubset<…>`, so a value outside `Tone`
  fails the build. A registry title names the components you import to use the item, comma-separated
  (`ListGroup, ListRow`), or the hook that is the item (`useServerRows`). Parts and helpers (`GlassToolbarButton`,
  `ThemeScope`, `useDataTable`, `formatCount`) are left out of the title, and the description can name them.
  `lede-theme` and `lede-utils`, styles and shared helpers, keep "Lede theme" and "Lede utils". A renamed prop keeps
  its old name for one release: optional, `@deprecated` naming the release that removes it, and the new name wins when
  both are passed.
- **Overlays.** Every overlay puts `ThemeScope` directly inside its portal. A portal renders outside its
  `ThemeProvider`'s wrapper, so without it the overlay silently loses its theme. `tests/theme-scope.spec.ts` walks
  `registry/` for this.
- **Contrast** 4.5:1 text / 3:1 UI; text rises to 7:1 in `-hc`, and UI stays at 3:1. `tokens/contrast.json` declares the pairs
  and the build checks them. Color never carries meaning alone.
- Respect `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast`.
- **Writing.** Every word a reader sees follows the Writing section of `CONTRIBUTING.md`: takeaway first, US English,
  summaries of at most two sentences, no marketing words or contrast framing, no serial comma, curly quotes in
  rendered strings, en-US dates.
- **Decisions.** The docs site's Decisions page (`src/pages/docs/Decisions.tsx`) records each decision about how Lede
  is built: why, its cost and what holds it. A PR that adds a gate, a test family or a rule adds its entry there in the
  same PR. A count on the page is computed from the file that owns it.
- **Checks are seen failing.** A new or changed test or gate is run against a mutant of the code it guards and fails there.
  The PR names the mutant. A check seen only passing can pass whatever the code does.
- **Linux fonts for reflow.** Reflow and text-size evidence comes from CI or the Playwright Linux container
  (recipe in `CONTRIBUTING.md`). macOS fonts can hide overflow that CI shows, and the container,
  with DejaVu Sans, reproduces CI's failures.
- **CHANGELOG.** New lines go under `## Unreleased`. A released section stays as it shipped: it's that version's record.

## Commands
- `npm run dev` — site at http://localhost:5173
- `npm run build` — tokens → registry → typecheck → site (`dist/`, includes `dist/r/`)
- `npm test` — Playwright + axe on every route in light, dark, light-hc, dark-hc (run `npm run build` first).
  It builds and serves its own copy, `dist-fixtures/`, with the `/fixtures/*` test pages, and a second on the next
  port, `dist-strict/`, with React's development build, where the `strict-*` projects run the focus specs under
  StrictMode. `npm run dev` has the fixture pages too; `dist/` leaves them out.
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
