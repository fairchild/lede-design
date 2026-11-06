# Contributing to Lede

Issues and pull requests are welcome. For a new component or a change to a token, open an issue first: Lede adds a
pattern only when no existing one fits.

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

`npm test` runs Playwright and axe on every route in all four themes, so run the build first. Use
[conventional commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `chore:`).

Changelog lines go in [CHANGELOG.md](CHANGELOG.md) under `## Unreleased`, and a breaking change or a rename says what
a consumer has to change. A released section stays as it shipped, because it's the record of what that version did.

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

[CLAUDE.md](CLAUDE.md) has the layers and the rules, including semantic HTML first, tokens only and contrast targets.
Edit tokens in `tokens/tokens.json` (the CSS is generated from it), and list every new registry file in `registry.json`.
`npm run registry` fails if a registry file imports something its item doesn't install. Add the item that provides it
to `registryDependencies`.

`npm run registry` also fails if a color has no pair or falls below its contrast floor. A new color token or
`color-mix()` goes in `tokens/contrast.json`, with what it can sit on, and every pair meets its floor. In -hc, every rule
that paints a control fill draws an `--input` edge, or `tokens/contrast.json` lists it as no control, with a reason.
`npm run contrast -- --report` prints every pair.

The same command fails on a number or color in registry CSS that comes from no token. A choice is a token in
`tokens/tokens.json`, and a value that follows from tokens is a `calc()` of them. The few numbers that are neither, such
as zero, hairlines and the `2` that doubles a token in a `calc()`, are listed in `tokens/literal-exceptions.json` with
their reasons, and an entry nothing matches fails the build. A number in a media or container query equals a
`breakpoint` token in the same unit. Window breakpoints are em, the browser's text size in a media query, so they're
for `@media` and `@custom-media` only. Write them in range syntax, `(width < 56.25em)`, so a query that stops short of
one needs no smaller number. DataTable's card width, `breakpoint-card-narrow`, is px, because em in `@container` is the
container's font size, and it can also be 0.02px less in a `max-width` query.
`npm run literals -- --report` prints what each entry and breakpoint covers.

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
