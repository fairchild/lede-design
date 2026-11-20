# Changelog

## 0.7.0

Looks: a `look` token family lets a theme change edges, depth, sheen, the pressed state and letter case without
restyling components, and the docs site's Looks page shows three looks over the same components. It adds AlertDialog,
CodeBlock, Page and Stack, ListRow details, a stability label on every registry item, live components in the design
system on claude.ai, and a docs benchmark. The registry for this release is
`https://lede.cloudcompute.com/r/v0.7.0/{name}.json`.

### Added

- Looks: a `look` token family lets a theme change what color, size and type don't reach. `look-hairline` and
  `look-control-edge` set the widths of separators and field edges, `look-surface-edge`, `look-control-shadow`,
  `look-control-sheen`, `look-well`, `look-press` and `look-press-shadow` set edges, depth, sheen and the pressed
  state, `look-ui-font` the interface's own face, `look-label-case`, `look-label-tracking`, `look-button-case` and
  `look-title-case` its letter case, and `look-texture` the ground. Each default draws Lede as it was, so nothing
  changes until a theme sets one. Button's fills set `background-color`, so a sheen stays on hover and on a critical
  Button. The docs site's new Looks page shows three looks over the same components (Skeuomorphic, Neo-brutalist and
  Broadsheet) and says how to make one; `?look=brutal` picks one on any page of the site. The three looks are the
  site's own, in `src/styles/looks.css`, and don't install. `tests/looks.spec.ts` runs axe on five pages in each look
  and theme, checks that high contrast keeps Lede's -hc colors under a look, and that a phone at 200% text is no wider.
- The design system on claude.ai runs Lede's real components. `components/bundle.js` assigns every registry export to
  `window.Lede`, and the system carries React 19 in `components/lib/`, so a canvas or an HTML artifact mounts Lede's
  components instead of copying their markup, and each card's preview is the component, working. Its README says how.
- The design system has a card for every registry item with a docs sample, the hero flows first. New samples for
  AppShell, WorkbenchShell, useServerRows and SpecView give those items theirs, and MasterDetail's shows SelectionBar.
  The Blocks page shows the code for AppShell, WorkbenchShell and useServerRows, and the Integrations page SpecView's.
  The README covers the theme and the shared utilities, which draw nothing.
- `docs/claude-design-system.md`: why each claude.ai account publishes its own Lede design system, and how.
  `npm run design-system -- --url <link>` builds it for that artifact, and `npm run design-system:check` loads every
  preview as the design system page does and fails on an error, a request outside the system or taken focus.
- `benchmarks/docs-agent/`: a harness that gives a fresh Claude Code agent a new Vite app and a task, with built docs
  as its only source, served from `llms.txt`. There are four tasks (an inbox, preferences, a server table and a status
  page, which is held out), each with fixed data and its own checks. A run's score is the share of scripted checks
  that pass: the task's behaviour on desktop and phone, axe in light, dark, phone and after the task's steps, a gutter
  and no sideways scroll, and source checks that it uses Lede without hard-coded colors or clickable `div`s. A blind
  Sonnet grader scores the screenshots against a fixed rubric beside it, never as part of it. It records tool calls,
  docs read, 404s, cost, time and the effort Claude Code applied, and appends each task's medians to `results.md`. A
  run that reads Lede's checkout is marked contaminated and left out. It defaults to Haiku, three runs a task, and
  isn't part of CI, since every run costs money. The README has the fairness and overfitting rules.
- Each registry item says how settled it is, in `meta.stability`: `experimental` for SearchField, StatusText,
  StatusList, CodeBlock, AlertDialog, Page and SpecView, and `stable` for the rest. A reference page's front matter
  and an experimental item's page and `llms.txt` line say so. The rule is in `CONTRIBUTING.md`.
- AlertDialog, `@lede/alert-dialog`: a modal that asks before an action, on Base UI AlertDialog, with Cancel and a
  confirm Button. Focus opens on the confirm button, or on Cancel when `tone` is `"critical"`, and returns to the
  control that opened it. Escape cancels, and PageHeader's `backOnEscape` waits for it to close. New tokens:
  `z-dialog` and `layout-dialog-max-width`.
- Page and Stack, `@lede/page`: Page is a page's box for an app without AppShell, with a gutter, a widest width
  (`"flow"`, `"narrow"` or `"full"`) and even space between its sections. Stack puts its children one under another
  with one gap, `"sm"`, `"md"` or `"lg"`, and their own top and bottom margins give way to it.
- PageHeader takes `leadingLink`, such as `{ href: '/', label: 'Home' }`: the picture in `leading` becomes a link
  named by the label, at least a hit target in size, such as an app's mark that goes home.
- ListRow takes `details`: content the row opens under itself, in the same list item, such as a run's log. The row
  becomes a `<button aria-expanded>` with a chevron that turns down while they show, find-in-page opens a row whose
  details hold the text, and `open`, `defaultOpen` and `onOpenChange` control it.
- CodeBlock, `@lede/code-block`: code or a log in a `<figure>` with an optional caption, in the mono type on
  `muted`. It grows to `layout-code-max-height` and then scrolls, as a named region a keyboard can scroll. `ansi`
  reads a terminal's escape codes, showing the eight colors as the tokens in `ANSI_TOKENS` so every app's logs agree,
  and `follow` keeps a streaming log's end in view until the reader scrolls up. `parseAnsi` is exported too.
- `tests/agent-names.spec.ts` fails when two visible controls of one role in the same region of a Daybook screen share
  a name, so a screen reader user or an agent can pick each one. Every screen passes today. The rule is in
  `CONTRIBUTING.md` and on the Decisions page.
- `docs/releasing.md` says how a release goes from merged pull requests to lede.cloudcompute.com: the release pull
  request, the tag only an admin can push, the `develop` branch every pull request now targets, how to check the release is live and what to do when a step fails.
- Each hero flow's reference page has an example of a whole screen: the flow in `Page`, since a flow brings no gutter
  of its own. Install step 4 says `LinkProvider` comes with `@lede/lede-utils`, so there's no `@lede/link` to add.
  The docs benchmark found both: agents asked the registry for `@lede/link`, and three of six screens built on a flow
  had no gutter.

### Changed

- Releasing needs one person's step: merging the release pull request. *Prepare a release* (from the Actions tab, or
  `scripts/prepare-release.mjs`) opens the prepare pull request into `develop`; when it merges, *Open the release pull
  request* opens `develop` → `main`; and when that merges and `check` passes, *Tag the release* creates `vX.Y.Z`, which
  runs Deploy. The pull request and the tag come from a release GitHub App on the tag ruleset's bypass list;
  `docs/releasing.md` says how to set it up, and without it each step is done by hand as before.
- The Integrations page, `llms.txt` and the `lede-design-system` skill name the maintainers' design system on
  claude.ai as theirs, which opens only for people it's shared with, and point everyone else to publishing their own.

### Fixed

- DataTable on a phone, or in any box narrower than `narrowBelow` with `narrow="scroll"`, no longer splits words such
  as "Degraded" or cuts short names to "web-sf…". When any column has no `width`, columns fit their content there (a
  `width` is a minimum), cells wrap only between words, and the table scrolls sideways once that doesn't fit. A
  `truncate` column keeps to one line, up to half the table's width (new token: `layout-table-truncate-max-width`).
  Wider boxes, and narrow tables whose every column has a `width`, keep the fixed layout. Table.Columns
  writes its summed minimum as `--ld-table-min-w`, which `.ld-table` reads as its `min-width`.

- `npx shadcn@latest add @lede/theme-provider @lede/list`, the README's install, no longer prints "Docs for
  ThemeProvider" twice. The shadcn CLI prints an item's line twice when it's named and is also another named item's
  dependency, so `theme-provider` prints no line; its page still installs, and the guide's line points at the list
  that names it.
- Claude review no longer fails every pull request when the Console refuses its sign-in. It checks the sign-in
  first, and when that's refused it prints the Console's answer and the token's subject, warns and skips the review.

## 0.6.0

Docs travel with the code: each registry item installs its reference page in `components/lede/docs/`, and each
release is mirrored on GitHub for sandboxes that can't reach the site. It adds StatusText, SearchField and StatusList, and
the docs' Overview opens on a live example. The registry for this release is
`https://lede.cloudcompute.com/r/v0.6.0/{name}.json`.

### Added

- Each release's registry is copied to the `registry` branch of the repo, so a sandbox that can reach GitHub but not
  lede.cloudcompute.com installs from
  `https://raw.githubusercontent.com/fairchild/lede-design/registry/r/v<version>/{name}.json`. The copy is byte for
  byte, made once Deploy has published the release, and never changes after.
- Each registry item installs its docs: its reference page lands at `components/lede/docs/<item>.md`, and `lede-theme`
  adds `components/lede/docs/README.md`, which lists every item of the release and holds the README's setup
  sections. A project that can't reach the docs site, such as an agent's sandbox, has the docs for the release it
  installed. The CLI prints where each item's page landed.
- `AGENTS.md` holds the repo's notes for coding agents, so agents other than Claude Code find them. `CLAUDE.md` is now
  one line that imports it.
- The README shows how to install the `lede-design-system` skill for Claude Code, from the release's tag, and
  `llms.txt` links the skill at the release's tag in place of `main`, so an agent reads the rules for the version it
  installs.
- StatusList, `@lede/status-list`: a block for a "needs attention" list. It takes items with a tone and a status in
  words, lists them worst first with their status as StatusText and two-line subtitles, and shows "Nothing needs a
  look." (or your `empty`) when there are none.
- The docs' Overview opens on a live example in place of the grid of count cards: Daybook's inbox, the three-panel
  workbench with its chat or the daily brief, chosen with a segmented control and shown wide or narrow. A short list
  of links with one line each takes the cards' place below it, and Install now comes before Principles.
- Overview's Use with an agent section holds a prompt to paste into a coding agent, with a Copy prompt button. It's written
  from the README's install steps and Limits, pins this release and asks the agent to leave a note in `AGENTS.md`
  or `CLAUDE.md` on where Lede's docs are. https://lede.cloudcompute.com/overview.md has it too.
- Choose a part, at https://lede.cloudcompute.com/choose: what you're building, and the component, block or flow that
  does it, each linked to its example.
- Each docs page names its Markdown version in a `<link rel="alternate" type="text/markdown">`, and a request for a
  docs route whose `Accept` header ranks `text/markdown` at least as high as `text/html` gets that Markdown.
- The README has a components.json section: the fields the shadcn CLI needs for Lede, in a file you can write by hand
  where `shadcn init` can't reach ui.shadcn.com, such as in a sandbox. `"baseColor": ""` keeps `add` from downloading
  too. It also says that Lede doesn't use the `ui`, `lib` and `hooks` aliases.
- The README has a Tailwind and Lede's classes section: Lede needs Tailwind v4 and leaves a page's layout to it. Use
  the token color names, such as `text-muted-foreground`, and Lede's type classes, such as `text-footnote`, in place
  of Tailwind's palette and `text-sm`.
- MasterDetail takes `stickyList`: on wide screens the list pane stays in view and scrolls on its own, and the page
  scrolls the detail, for a long list beside a long detail.
- ListRow takes `subtitleLines`: `2` clamps the subtitle to two lines and `'all'` shows every line, where the default
  is one line that ends in an ellipsis.
- ListGroup takes `empty`, shown in place of the rows when there are none, such as "No hosts match" under a filter.
- StatusText, `@lede/status-text`: a status word colored by its tone (`neutral`, `positive`, `caution` or
  `critical`), with a dot, at the size of the text around it. Put it in a ListRow's `value` or `subtitle`, a table
  cell or a sentence, as in `value={<StatusText tone="critical">Failed</StatusText>}`.
- SearchField, `@lede/search-field`: an `<input type="search">` with a visually hidden label and a clear button, for
  filtering a list. Escape clears its text and keeps focus; on an empty field it goes on to the screen, so PageHeader's
  `backOnEscape` backs out.
- The README's install section has "Start from a new Vite app": the commands and file edits that set up Tailwind v4,
  the `@/*` alias and a `components.json` in an app made with create-vite, run as written.
  https://lede.cloudcompute.com/overview.md shows it too.
- A registry item's reference page shows each type it names from another item, under the props table that uses it
  and under its declarations: a short type written out, such as `Noun` on DataTable's page, and a long one linked to
  the page that declares it. `llms-full.txt` has the props tables' lists too.
- A reference page says which attributes a component takes beyond its props table: ThemeProvider's says it also takes
  the attributes of `<div>`, such as `className`, and the `render` prop of Base UI's `useRender`.
- Checkbox's props table lists `className`, `style` and `hidden`, and TextField's lists `className`, each with the
  wrapper it goes on. Checkbox puts them on its wrapper `<span>` and TextField on its wrapper `<div>`, as before.
- When a reference page's install command adds an item only for its example, such as `@lede/button` on PageHeader's
  page, the page says so.
- `llms.txt` has a "Start here" section above Docs: which file answers which task (install, choose a part, lay out a
  page, use one item, change a token), with each file's size in kilobytes and the range of the reference pages, so a
  reader can tell what fits before it fetches. It says when `llms-full.txt` is worth its size.

### Changed

- The `ld-status` classes live in the components' stylesheet and carry no margin or size of their own, so they fit
  any text. SummaryCard and DataTable keep their status at the footnote size.
- Step 1 of the install steps adds `@lede/theme-provider` and `@lede/list`, the items step 3 imports, where it added
  a data table and two hero flows. It links `llms.txt` for the name and import line of every item.

### Fixed

- `llms.txt` and `llms-full.txt` are served as `text/plain; charset=utf-8`, so their curly quotes read correctly.

## 0.5.3

The docs site reads without JavaScript: every page links `llms.txt`, and each docs page and registry item has a
Markdown version. Lede has a design system on claude.ai. The registry's files are the same as in 0.5.2, and the registry
for this release is `https://lede.cloudcompute.com/r/v0.5.3/{name}.json`.

### Added

- Lede has a design system on claude.ai, https://claude.ai/artifact/Cw9GgaD1zxRk9ewxGMHv4x, that Claude reads to build
  with Lede in a chat artifact, a design canvas, a deck or Claude Code. It holds the tokens, the whole stylesheet in one
  file and a card for each component: its props, read from the source with their doc comments, every variant and state
  rendered with its HTML, its accessibility, its React sample and the HTML that sample renders. `npm run design-system`
  builds it from this repo.
- The Integrations page has a Claude section that links the design system and a canvas of Lede's foundations and
  components, and shows how an HTML artifact copies Lede's stylesheet. `llms.txt` and the `lede-design-system` skill
  link them too.
- Every page of the docs site, fetched without JavaScript, says what Lede is and links
  https://lede.cloudcompute.com/llms.txt, the registry index and the repo. A browser with scripts off shows the same
  text. The docs footer and the README link `llms.txt` too.
- `llms.txt` names the registry indexes and what they return, and links the README's Limits, the
  `lede-design-system` skill and the json-render chat recipe as Markdown files.
- Each docs page has a Markdown version at its address plus `.md`, such as
  https://lede.cloudcompute.com/components.md, built from the page the site renders, with each token's values and each
  item's import line. The home page's is `/overview.md`, with the README's requirements, install steps and limits. Each
  registry item has a reference page, such as https://lede.cloudcompute.com/reference/list.md: its install command,
  import line, what each file exports, props, example and types. The files are served as `text/plain` and form an Open
  Knowledge Format v0.2 bundle: each opens with YAML front matter (`type`, `title`, `description`, `resource`), and
  `/index.md` and `/reference/index.md` list them. https://lede.cloudcompute.com/llms-full.txt holds the pages and
  reference pages in one file, without the types, the front matter or the indexes.
- `llms.txt` is built with them: it names this version and links each docs page's Markdown version and each item's
  reference page with its import line.

### Changed

- The site answers 404 for a file it doesn't have, such as `/reference/nope.md`, where it used to answer with the docs
  page. Paths without a file extension still open the docs. A 404 under `/r/` names the registry index.

## 0.5.2

Fixes from the reviews of SpecView: fields are checked right before each action, `check` reads bindings and a row
waits for the View it opens. PageHeader takes a level 3 title and a back that acts in place. The registry for this
release is `https://lede.cloudcompute.com/r/v0.5.2/{name}.json`.

### Changed

- PageHeader's `headingLevel` takes 3, which draws a smaller title, for a header under another heading of the page.
  Its `back` takes `{ label, onSelect }` for a back that acts in place, drawn as a button, beside `{ href, label }`.
  `onSelect` decides where focus returns.
- In `json-render`, every event of every element runs its actions in order, and right before each one the fields its
  params read are checked, so an earlier action that empties a field holds back the submit that reads it, one that
  fills it lets the submit run, and a Switch's change is checked as a press is. Actions before a held one resolve their
  params against their repeat item, as json-render's own run does.
- `check` reads each element's bindings: an event its type doesn't emit, an action the catalog doesn't have, params
  its schema rejects, and a slot or `$computed` function the catalog doesn't name. A prop the catalog doesn't have is
  an issue whatever its value. Before, one bound to an expression made `check` throw.
- A row whose press opens a detail View acts, and shows its chevron, once that View has arrived, so a press while the
  reply streams no longer blanks the screen. A press that hides every control leaves focus on the screen.
- `SpecView` takes `fallback`, drawn for a type the registry doesn't have. Its `handlers` are typed from each action's
  schema and read through a ref, so an inline object is fine, and one that returns a promise holds the actions after
  it until it settles. The registry draws every header with PageHeader.

### Removed

- `registry.tsx` in `json-render` no longer exports `actions`, `ActionEvent` or `handlers`, the action log of the
  repo's json-render page, which now builds its own from `SpecView`'s `handlers`. They weren't documented.

### Fixed

- `integrations/json-render-chat`: a message sent while a reply streams waits for that reply and says so, and a
  failed reply keeps its mark after the next question and stays out of what the model reads. `handleChat` counts a
  body's bytes as it streams in and answers 400 to a system message, a turn left with nothing to read and a reply
  whose screen can't be written back, where it answered 500 or passed the error to the model.
- `integrations/json-render-chat-plain`: a message sent while a reply streams waits for that reply, as in the Lede chat.

## 0.5.1

The docs site has an Integrations page, linked from Overview. The registry for this release is
`https://lede.cloudcompute.com/r/v0.5.1/{name}.json`.

### Added

- The docs site has an Integrations page, reached from Overview's Explore section. It shows how to install SpecView,
  draws a spec with it on the page and links to the three example apps in `integrations/`.

## 0.5.0

SpecView lets a model's reply be a Lede screen, and `Table.Row` drops the `linked` prop deprecated in 0.4.0. The
registry for this release is `https://lede.cloudcompute.com/r/v0.5.0/{name}.json`.

### Added

- `json-render`, titled SpecView, lets a model's reply be a Lede screen. It installs a json-render catalog of 13 Lede
  components, `prompt()`, which gives a model json-render's prompt in this catalog's terms with Lede's `rules`, a
  registry that draws each component, `catalog-fit` for the typecheck, `check` for a spec's props, `specFromParts` and
  `SpecView`. `functions` holds `scale`, `remaining` and `sum`, for values a spec works out with `$computed`. An
  action that reads a field failing its browser check doesn't run: each such field shows its `error`, a plain string,
  until its value passes, and focus moves to the first. Enter in a one-line TextField runs its
  actions, a number field keeps a number in state and takes decimals unless `step` says otherwise, a TextField takes
  `type: "date"`, `pattern`, `minLength` and `maxLength` and a SegmentedControl or Checkbox in a spec can be required
  and show an error. `SpecView` takes input while a spec streams and keeps what the person changed, reports the
  screen's state through `onStateChange` and an action held back, with the error each field shows, through
  `onActionHeld`, moves focus on when a press hides the control that made it and warns in development when Lede's CSS
  isn't loaded. It needs `@json-render/core` and `@json-render/react` at exactly 0.22.0.
  A row or a Button opens an item in place: Screen's children are Views, a press sets the state path they read, and a
  detail's PageHeader takes `back`, whose button, or Escape while focus is in that screen, shows the list again. The
  detail's title takes focus, Back returns it to the row that opened the detail, and a row shows a chevron only when
  its press is bound; `check` flags a row whose press opens no View.
  `integrations/json-render-chat` uses it in an AI SDK chat, with a guide around the chat: Try it, where each reply
  shows how it was made, How it works and Build it, which draw the example's README.
- `ld-checkbox-field` on a `<label>` that holds a Checkbox keeps a long label in a column beside the box, with the
  default cursor while the Checkbox is disabled.
- EmptyState's `headingLevel` takes 4.
- A PageHeader inside a flow's stack drops its bottom margin, so the space under it stays one step when an
  inline-level control, such as a SegmentedControl, comes next.

### Changed

- Docs site: the sidebar's footer, and the page foot that holds it on narrow screens, links to GitHub, with its mark,
  and the version. The demo app and Decisions are reached from Overview.

### Removed

- Table: `Table.Row` no longer takes `linked`, deprecated in 0.4.0. A row that holds a `Table.RowLink` is linked on
  its own, so drop the prop.

### Fixed

- ListRow: after an action that keeps its row, a click that focuses nothing lets the row's saved place go, as a click
  on a focusable element already did. Safari on macOS doesn't focus a button on click, so a button there that later
  removed the row moved focus to the row beside it.

## 0.4.0

First public release. Lede is a design system for React, installed from its shadcn registry at
`https://lede.cloudcompute.com/r/v0.4.0/{name}.json`.

- 12 components, each a native element where HTML has one, with Base UI for the interactions HTML can't do.
- 12 blocks, the larger parts of a screen, among them DataTable and the page layouts AppShell and WorkbenchShell.
- 5 hero flows, whole screens built from blocks that take data, hrefs and callbacks from your app.
- Tokens for color in four themes (`light`, `dark`, `light-hc` and `dark-hc`), type, spacing, radius, motion and more.

### Fixed before release

- useServerRows: a page whose `nextCursor` is `null` ends the list and settles the count at the rows through it,
  whatever the page's length. A `fetchCount` answer below the rows held from the first row on reads as a lower bound
  of those rows, so Load more and Next stay offered.
- useServerRows: the first render, and a server render, show the table loading until the first rows arrive. They
  showed the empty state.
- The registry's error responses (404, 412, 503 and 405) carry `access-control-allow-origin: *` like its JSON does, so a
  page fetching an item can read why it failed. An `OPTIONS` request under `/r/` answers the CORS preflight.
- Files under `/media/` are typed by their extension alone and sent with `content-security-policy: sandbox` and
  `nosniff`, so a file can't run as a page on the site's origin.
- ListRow: a row with `href` runs its `onClick` too. A row action that removes its row keeps the reader's place: focus
  moves to the next row, else the one before, else the group's heading, else the next visible control in reading
  order. A parent that moves focus itself in a layout effect, as InboxFlow does, keeps its choice, and an action that
  takes the whole group away, such as a navigation, leaves focus to the parent. A swipe action that leaves its row in place
  moves focus to the row as the actions close.
- MasterDetail: a `detail` of `false`, `true`, `''` or `0` counts as nothing selected, so `selected && <Message />`
  works. When the panes swap on a narrow screen, focus moves to the detail's first heading as it opens and back to the
  row that opened it as it closes.
- WorkbenchShell: a shell too narrow for its main pane, with both panels collapsed, draws them at 0 wide where it
  drew `NaN`.
- ThemeProvider: its doc comment and the README's Limits say that stock shadcn `dark:` utilities, high contrast and
  `glass="solid"` reach a light provider nested in a dark one, as shadcn's own `.dark` class does.
- DataTable's Try again moves focus to the summary line after the retry's state is in, so the summary has its text
  when focus arrives. The narrow-layout sample on the docs page now compiles: it passes `noun`, and its columns fill
  the card slots its comment describes.
- Table: a development build warns when a collapsible table's caption or summary renders an element that isn't
  phrasing content, or an interactive one such as a link, a label, a control or an iframe, since both sit inside the
  toggle button. Phrasing content such as `<abbr>`, `<em>` and `<span lang>`
  doesn't warn. The types are unchanged.
- Table: a development build warns when `collapsible.open` switches between controlled and uncontrolled.
- Table: the collapsible caption's corners match the table's box, and in the high-contrast themes the box's edge runs
  unbroken past the sticky header.
- A Button whose label wraps is a rounded rectangle, with corners of `--radius-xl` or more. A one-line Button is
  still a capsule and an icon-only one a circle, at every size, shape, density and text size.
- A GlassToolbarButton whose label wraps keeps the curve of one line, so it stays concentric with the toolbar.
- A card Disclosure's focus ring and pressed fill follow the card's corners: all four while it's closed and the top two
  while it's open. A plain Disclosure stays square.
- A SegmentedControl whose value matches no option shows no thumb, since no radio is checked. This covers a controlled
  `''`, a misspelled `defaultValue` and options that arrive after the first render. Choosing an option shows the thumb
  on it.
- OnboardingFlow's `onComplete` may return a promise. While it's pending, Finish shows “Finishing…” and can't fire
  again. It resolves to the done step, and a rejection stays on Review with an inline error. A `void` return still
  moves on at once, and Finish fires once until the step changes.
- OnboardingFlow: a controlled `step` past Account with no valid account waits for Continue, so the keystroke that
  makes the account valid no longer switches steps under the cursor.
- ProfileFlow and OnboardingFlow: a field with an error checks itself again on each change, so the error leaves once
  the value is fixed. A failed submit makes the field invalid before focus reaches it, so the move reads the error.
  When focus was already on that field the errors are announced instead, so a screen reader says them once.
- OnboardingFlow: an `onComplete` that throws as Finish is pressed shows its error on Review, and Finish works again.
  A save that settles after the step changed, such as by the browser's Back, no longer moves to the done step.
- DataTable: the `rowActions` doc says it's called during render for every row, so it should be cheap.
- TextField takes a `ref` to its `<input>` or `<textarea>`.
- An invalid TextField shows the focus ring outside its red edge when focused, as errors send focus there.
- DataTable: an uncontrolled selection drops rows that were deleted, so after a bulk Archive the bar leaves with its
  rows and the next action sends only what's selected. A row counts as deleted when it leaves `rows` while the view,
  the page and `state.rows` stay the same, so a row on another page stays selected. `useDataTable` takes `paging` to
  tell the two apart.
- DataTable: "Select all N" becomes "Clear selection" in place and keeps focus, and Clear selection moves focus to the
  summary line.
- DataTable: when a sort or a page change fails to load, focus moves to Try again as the alert arrives.
- DataTable shows its loading skeleton while `state.rows` is `'none'` and nothing failed, so a `useServerRows` table
  never shows "No {noun}" or a count of 0 before its first request goes out.
- DataTable: `sortable: true` works in server mode without `value` or `compare`, since the server sorts.
- SelectionBar centers in the viewport when no AppShell holds it. AppShell now adds the bar's offsets itself, beside
  the sidebar on a desktop and above the tab bar on a phone.
- Table: every control in a linked row sits above the row link and takes its own press, in any cell and before or
  after the row header, so a Button in a DataTable column no longer navigates. The rest of the row still does.
  The undocumented `ld-table-control` class is gone.
- Table: a row that holds a Table.RowLink is positioned on its own, so its link covers that row and not the whole
  table. `Table.Row`'s `linked` is deprecated and changes nothing; it's removed in 0.5.0. A `sticky` row-header cell
  confines the link to that cell, as RowLink's doc comment says.
- Table: `ColumnWidth.max` is removed. It was undocumented and had no effect, or made the columns overflow when it
  was below another column's `min`.
- `Table.Root`'s doc comment shows on hover again.
- DataTable: a row whose `rowActions` returns no actions has no ••• in the table layout, as in the card layout.
- DataTable cards: the sort and select-all bar stays mounted while the skeleton shows, as the table's header does, so
  a sort answered with a skeleton keeps focus on the Sort menu.
- DataTable cards: a card with no link, checkbox or actions takes focus on its title, so Load more lands on the first
  new card, as it lands on the row header in the table layout.
- A glass Card is opaque under `prefers-reduced-transparency`, as every other glass surface is.
- Enter on a Switch inside a form clicks the form's default button, as Enter on a native checkbox does: that button's
  `onClick` runs, and a disabled default button means no submit. An image button counts as the default button, and a
  form with no submit button doesn't submit, as from a native checkbox.
- A Switch answers a press over `size-hit-min` in every density, though its track is drawn 30px tall.
- An uncontrolled GlassBar of links marks the item whose `href` is the page's path, so a page loaded at its second
  item no longer marks the first. A Cmd, Ctrl, Shift or Alt click leaves the mark where it is.
- Checkbox runs the cleanup a React 19 callback ref returns.
- StepIndicator's one-line summary is read on narrow screens, where it's all that shows. It's a group named "Progress",
  since its steps aren't links.
- An inner layer using `useBackOnEscape` takes Escape before the screen's PageHeader, even when both opened in the
  same commit or the screen turned `backOnEscape` back on while the layer was open. Of several inner layers, the most
  recently activated one takes it.
- The docs for PageHeader's `focusOnMount` and `backOnEscape` describe what they do: the heading takes focus each time
  `focusOnMount` turns `true`, and `backOnEscape` yields to the focused field when its text changed.
- Switch, SegmentedControl, Disclosure, Avatar and GlassBar take HTML attributes such as `id`, `data-*` and
  `aria-describedby`, and a `ref`. Each lands on the element the person sees and acts on: Switch's `role="switch"`
  element (its `id` and form props go on the native checkbox Base UI keeps, so `<label htmlFor>` names it), the
  `<fieldset>`, the `<section>`, the `<img>` or initials `<span>` and the `<nav>`. Switch and SegmentedControl also
  take `required` and `form`, and Switch takes `value`, `uncheckedValue`, `readOnly` and `inputRef`. Switch's type
  names each prop it supports and holds no Base UI type.
- A Switch's `onKeyDown` that prevents Enter's default stops the implicit submit.
- Avatar passes `loading`, `decoding`, `referrerPolicy` and `crossOrigin` to its `<img>`.
- Table.Root passes HTML attributes to its `<table>`, while `className`, `style` and `ref` stay on the scroll box.
- SegmentedControl and Table.Root run the cleanup a React 19 callback ref returns, as Checkbox does.
- Checkbox puts `style` and `hidden` on its wrapper with `className`, so `<Checkbox hidden />` hides the drawn box too.
  Every other attribute and the `ref` go on the input.
- Button takes `ref` as a plain prop, as React 19 allows, and no longer wraps itself in `forwardRef`. A ref typed for
  either element still fits.
