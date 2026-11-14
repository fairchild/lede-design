# Contributing to Lede

Issues are the best way to help: bug reports and feature requests both. Pull requests are welcome too; for anything
beyond a small fix, open an issue first so we agree on the change before you build it.

**A bug report** says how to make it happen: the steps, what you expected and what happened. Include the Lede version,
the browser and the theme, and attach a screenshot, a recording or a console log when you have one. A bug that
reproduces gets fixed first.

**A feature request** describes what you're building and where Lede falls short. For a new component or a change to a
token, name the existing pattern you tried: Lede adds a pattern only when no existing one fits.

Report a security issue privately, as [SECURITY.md](SECURITY.md) describes.

The rest of this file is how Lede is built and checked, for a pull request, a fork or a failing test that
shows what you found. A test that fails makes the clearest bug report.

## Set up

```bash
npm install
npx playwright install chromium
npm run dev
```

The docs site and the Daybook demo app run at http://localhost:5173.

## Before you open a pull request

```bash
npm run build
npm test
```

`npm test` runs Playwright and axe on every route, in all four themes on desktop and in `light` and `dark-hc` on a
phone, so run the build first. Use [conventional commits](https://www.conventionalcommits.org) (`feat:`, `fix:`,
`chore:`).

In [CHANGELOG.md](CHANGELOG.md), add your lines under `## Unreleased` at the top, and create it if it isn't there. A
release renames it to the version. A breaking change or a rename says what a consumer has to change, and a released
section stays as it shipped, because it's the record of what that version did.

A new or changed test or gate is shown failing once. Break the code it guards (a mutant), watch the check fail, put the
code back and name the mutant in the pull request. A check seen only passing can pass whatever the code does.

Reflow and text-size results come from Linux fonts, in CI or in the Playwright container. A page that fits with macOS
fonts can scroll sideways in CI, and the container, with DejaVu Sans, reproduces CI's reflow failures. To run the
browser in the container against your own checkout, match the image tag to `@playwright/test` in `package-lock.json`:

```bash
docker run -d --rm --init --name pw-linux -p 3000:3000 mcr.microsoft.com/playwright:v1.64.1-noble \
  sh -c "apt-get update -qq && apt-get install -y -qq fonts-dejavu-core && npx -y playwright@1.64.1 run-server --port 3000 --host 0.0.0.0"
# Wait until `docker logs pw-linux` prints "Listening", then:
PW_TEST_CONNECT_WS_ENDPOINT=ws://127.0.0.1:3000/ PW_TEST_CONNECT_EXPOSE_NETWORK='<loopback>' npx playwright test tests/reflow.spec.ts
docker stop pw-linux
```

## How the code is organized

Lede has five layers, and dependencies only point down:

1. `tokens/tokens.json` is the single source for color in four themes, type, weight, spacing, radius, stroke, shadow,
   blur, size, layout, opacity, motion, layers and breakpoints. `npm run tokens` writes `src/styles/lede.tokens.css`
   and `registry/lede/lede.tokens.css`, which are generated and git-ignored.
2. `registry/lede/*.tsx` holds the components, styled by `lede.components.css`.
3. `registry/lede/blocks/*.tsx` holds the blocks, page layouts among them, styled by `lede.blocks.css`.
   `registry/lede/json-render/` sits here too: a json-render catalog and registry over the components, with no CSS of
   its own.
4. `registry/lede/flows/*.tsx` holds the hero flows. A flow takes data, hrefs and callbacks, and it fetches nothing and
   imports no router.
5. `src/` is the docs site and Daybook, the demo app, which wire the flows to React Router and sample data.

`integrations/` sits outside the layers. It holds self-contained apps that show Lede beside another project. They read
`registry/`, and no layer imports them.

Lede's design system on claude.ai, which Claude reads to build with Lede in a chat, a canvas or a deck, is generated
from this repo too. `npm run design-system` writes it to `dist-design-system/project/` (git-ignored): `tokens.json` in
the shape the design system page reads, `components/bundle.css` with every token, component and block style, and a
card for each registry item with a sample in `src/pages/docs/samples/`, rendered to static HTML by React's server
renderer. The README and the cover are `scripts/design-system/README.md` and `cover.html`. After a release, run it and
publish the folder to the design system's artifact from Claude Code: read the live `project/design-system.json` first,
so the page's own keys survive, then send every file under `project/`.

Registry files use relative imports (`../list`) that match where they install (`components/lede/…`). Every file that
installs is listed in `registry.json`. The `index.ts` barrels are for this repo only and don't install.
`npm run registry` builds each item's JSON from `registry.json` into `public/r`.

Edit tokens in `tokens/tokens.json` (the CSS is generated from it), and list every new registry file in `registry.json`.
`npm run registry` fails if a registry file imports something its item doesn't install. Add the item that provides it
to `registryDependencies`, or the package to `dependencies`. It also fails a dynamic import with a computed path, two
files with one target and a file under `registry/` that no item lists.

`npm run registry` also fails if a color has no pair or falls below its contrast floor. A new color token or
`color-mix()` goes in `tokens/contrast.json`, with what it can sit on, and every pair meets its floor. In the
high-contrast themes (`light-hc` and `dark-hc`), every rule that paints a control fill draws an `--input` edge, or
`tokens/contrast.json` lists it as no control, with a reason.
`npm run contrast -- --report` prints every pair.

The same command fails on a number or color in registry CSS that comes from no token. A named color such as `white`
and a Tailwind palette utility in `@apply`, such as `bg-red-500`, are colors too. A choice is a token in
`tokens/tokens.json`, and a value that follows from tokens is a `calc()` of them. The few numbers that are neither, such
as zero, hairlines and the `2` that doubles a token in a `calc()`, are listed in `tokens/literal-exceptions.json` with
their reasons, and an entry nothing matches fails the build. A number in a media or container query equals a
`breakpoint` token in the same unit. Window breakpoints are em, the browser's text size in a media query, so they're
for `@media` and `@custom-media` only. Write them in range syntax, `(width < 56.25em)`, so a query that stops short of
one needs no smaller number. DataTable's card width, `breakpoint-card-narrow`, is px, because em in `@container` is the
container's font size, and it can also be 0.02px less in a `max-width` query.
`npm run literals -- --report` prints what each entry and breakpoint covers.

## Rules

- **Semantic HTML first.** Use the native element if one exists: `<button>`, `<a href>`, `<fieldset>`, `<nav>`,
  `<section>` with a heading, `<ul>`. Base UI comes in only when HTML can't do the interaction, and ARIA only for what
  HTML can't express. Navigation is a link and an action is a button. No `div role="button"`, and no interactive
  element inside another.
- **One h1 per screen.** It's the PageHeader's, and it takes focus on navigation. Regions are named, and headings step
  down one level at a time.
- **Focus.** Focus lands where the person acts next: the h1 to read, the first field that needs input to type and the
  primary button to confirm. Enter acts, and Escape backs out one layer per press. Back and back links return to where
  the person was. Each change moves focus once, in the same task, so `<body>` never shows, and an announcement follows
  it. `tests/focus-table.ts` is the source of truth. Its `test.fixme` rows say what they wait for, and a pull request
  that adds a screen or an action adds its rows there. An app in `integrations/` keeps its focus specs in its own
  tests, beside the screens it builds, since the root suite doesn't build it.
- **Progressive disclosure.** Every screen, section and row leads with its takeaway (`summary`). Affordances stay quiet
  and appear at the point of use. Expert paths, such as swipe, always have a visible twin.
- **Tokens only.** Components use no raw colors or radii. They use shadcn's names (`--primary`, `--muted-foreground`)
  or Lede's extras, and text on a tint uses `--ld-primary-on-tint`. Radii derive from `--radius` and `--radius-step`,
  so nested corners are concentric.
- **Prefixes.** Component classes start `ld-`, and component custom properties start `--ld-`. Tokens from
  `tokens/tokens.json` keep their plain names (`--primary`, `--fill-control`, `--space-4`), type classes are `text-*`
  and docs-site helpers start `docs-`. Two letters keep stacked class lists short. The prefix also sits inside `field-`
  and `build-`, so a search for it uses `(?<![\w-])(--)?ld-`.
- **Names.** A heading prop is `title`. A value callback is named for its controlled prop: `value` and
  `onValueChange`, `checked` and `onCheckedChange`, `open` and `onOpenChange`. A wrapper that passes native input props
  through keeps the DOM's `onChange`. Color that carries meaning is a `tone` declared with `ToneSubset<…>`, so a value
  outside `Tone` fails the build. A registry title names the components you import to use the item, comma-separated
  (`ListGroup, ListRow`), or the hook that is the item (`useServerRows`). Parts and helpers (`GlassToolbarButton`,
  `ThemeScope`, `useDataTable`, `formatCount`) stay out of the title, and the description can name them. `lede-theme`
  and `lede-utils` keep "Lede theme" and "Lede utils". A renamed prop keeps its old name for one release: optional,
  marked `@deprecated` with the release that removes it, and the new name wins when both are passed.
- **Overlays.** Every overlay puts `ThemeScope` directly inside its portal. A portal renders outside its
  `ThemeProvider`'s wrapper, so without it the overlay loses its theme. `tests/theme-scope.spec.ts` checks every file
  in `registry/` for this.
- **Contrast.** Text meets 4.5:1 and UI 3:1. In the high-contrast themes text rises to 7:1, and UI stays at 3:1. Color
  never carries meaning alone.
- **User preferences.** Components respect `prefers-reduced-motion`, `prefers-reduced-transparency` and
  `prefers-contrast`.
- **Decisions.** The docs site's Decisions page (`src/pages/docs/Decisions.tsx`) records each decision about how Lede
  is built: why, its cost and what holds it. A pull request that adds a gate, a test family or a rule adds its entry
  there in the same pull request. A count on the page is computed from the file that owns it.

## Writing

These rules cover every word a reader of Lede sees. Lede's own explanations say what a thing is, what it's for and how
to use it, takeaway first.

That means the docs pages, the demo's content, UI strings and accessible names in components and flows, the README,
the CHANGELOG, registry titles and descriptions, token usage text in `tokens/tokens.json` and comments in files that
install into a project. A change applies the rules to the text it writes or edits and leaves the rest as it is.

### Voice

The voice covers all of it except the demo's sample data (its messages, tasks and people), which follows only the
Conventions, so its characters can say "rather than".

The model is the opening of "Full page with left bar" on the Layouts page: "One left bar and one page that scrolls
beside it. Pick it for an app with three to five places, where each place is a whole screen."

Describe what a thing does and leave the judgment to the reader, without marketing words (*powerful*, *seamless*,
*beautiful*, *effortless*). Contrast framing, which sets a thing against something it isn't (as in "X, not Y", "this,
not that", "isn't just … it's", "rather than" or "more than just"), goes too. Say what it is.

| Before | After |
| --- | --- |
| Lede isn't just a component library. It's a new way to build apps. | Lede is a design system for React: components, blocks and flows, installed from a shadcn registry. |
| Skip link → top bar → `<nav>`, `<main>` and `<aside>` side by side. Side panels collapse and resize; each panel scrolls alone; narrow screens show one at a time. | A top bar over three panels that fill the window. Pick it when people keep several things in view while they work. |

In the second pair, the panel details move into the page body, for the reader who wants them.

### Order

A reader decides in the first screen whether to keep going, so a README or a docs page gives the fastest content
first and opens detail one level at a time, as Lede's own screens do.

1. What it is, in one or two sentences.
2. Who it's for and who it isn't, when that isn't obvious.
3. How to install it.
4. One example that runs.
5. Links to the rest.

Everything else goes a level down: a later section, the docs site or the API reference. A README links to the guide
and doesn't repeat it.

- **State the rule first.** Its exceptions go in the reference. "`--radius` sets every corner" belongs in the README.
  "Capsules and circles aside, and a Button whose label wraps is a rounded rectangle" belongs on the Foundations page.
- **Name three, link the list.** Prose carries at most three examples of a kind. The full list is a table or the page
  that owns it, and a count is computed from the file that owns it.
- **Use a plain word, or define the coined one where it first appears.** "View", "visit", "flow" and "takeaway" mean
  something specific here. A reader meeting one for the first time gets its meaning in the same sentence.
- **Keep process out of the product's pages.** Test file names, how the site is published and how CI picks what to
  run live in CONTRIBUTING.md.
- **Show what a sentence would describe.** A screenshot for something visible, a short recording for something that
  changes, and a diagram for a relationship among three or more parts. Each has alt text that says what it shows.

| Before | After |
| --- | --- |
| Blocks: AppShell and WorkbenchShell for page layouts, PageHeader, SummaryCard, MasterDetail, FormSection, StepIndicator, EmptyState, SelectionBar, AccentPicker and DataTable. DataTable is a `<table>` with sorting, selection, row links, row actions and optional cards for narrow containers. (the README's old Blocks bullet) | Blocks: the larger parts of a screen. AppShell, PageHeader and DataTable are three. (a table row, with a link to the Blocks page) |
| Components: ThemeProvider, Button, SegmentedControl, Switch, TextField, Checkbox, Avatar, Card, ListGroup with ListRow, Disclosure, Table and GlassBar with GlassToolbar. | Components: primitives, each a native element where HTML has one. Button, Switch and ListGroup are three. (with a link to the Components page) |
| Lede renders on the client only, so use it in a Vite app or another client-only React app. It doesn't support server rendering yet: registry files have no `'use client'`, so Next's App Router fails at build. (a paragraph before the install steps) | "a client-rendered React 19 project, such as a Vite app" in the requirements sentence, with the Next detail under Limits. |

### Reviewing copy

Before a release, and in any pull request that changes a README or a docs page, read the page as a newcomer and check:

- The first screen says what it is and how to install it.
- No sentence persuades. Each one says what a thing is, what it's for or how to use it.
- Each paragraph has one job, and a detail only some readers need is linked.
- Every coined term is defined where it first appears.
- A visual stands wherever prose describes something a reader could see.

### Conventions

- US English: color, gray, behavior, center, summarize, memoize, canceled. Identifiers keep the spelling of what they
  name (`aria-labelledby`).
- No serial comma: "sorting, paging and states". Where a list reads ambiguously without one, reword it.
- Summaries (the `summary` prop, a page's intro, a registry description) are at most two sentences, and a semicolon
  ends a sentence. Detail moves to the body, the API reference or tests.
- Props, string values a prop takes (`"cards"`), CSS properties, elements, file paths and commands are code. Component
  names and titles stay plain. In JSX, wrap code in `<code>`. Token usage text, registry descriptions, Markdown and
  comments take backticks.
- Strings in `.ts` and `.tsx` files that render or are announced, and token usage text, use curly quotes and
  apostrophes (’ “ ”) outside code, so install commands and code samples keep straight ones. Markdown files and
  comments, JSDoc included, can use straight ones.
- Dates and times follow en-US: "Friday, November 6", "Nov 6, 2026", "9:41 AM". Installed components format with the
  reader's locale. The demo and docs pass `'en-US'`.
- Notes on Lede's own plans and progress ("SEED", "No CSS reads it yet") and issue numbers stay in issues and pull
  requests. A limit the reader needs to know, such as client-only rendering, stays.

### Comments in installed files

JSDoc on a value says what it is, its default and its key constraint. Other comments say why. Each takes a line or
two, and invariants and edge cases live in tests.

```ts
/** Width in px, from 200 to 480. Default 280. */
```
