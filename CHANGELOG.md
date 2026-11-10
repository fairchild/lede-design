# Changelog

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
  `onClick` runs, and a disabled default button means no submit. A form with no submit button still submits.
- A Switch answers a press over `size-hit-min` in every density, though its track is drawn 30px tall.
- An uncontrolled GlassBar of links marks the item whose `href` is the page's path, so a page loaded at its second
  item no longer marks the first. A Cmd, Ctrl, Shift or Alt click leaves the mark where it is.
- Checkbox runs the cleanup a React 19 callback ref returns.
- StepIndicator's one-line summary is read on narrow screens, where it's all that shows. It's a group named "Progress",
  since its steps aren't links.
- Of several layers using `useBackOnEscape`, the most recently activated one takes Escape, so an inner layer backs out
  before the screen's PageHeader.
- The docs for PageHeader's `focusOnMount` and `backOnEscape` describe what they do: the heading takes focus each time
  `focusOnMount` turns `true`, and `backOnEscape` yields to the focused field when its text changed.
