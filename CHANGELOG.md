# Changelog

## 0.4.0

First public release. Lede is a design system for React, installed from its shadcn registry at
`https://lede.cloudcompute.com/r/v0.4.0/{name}.json`.

- 12 components, each a native element where HTML has one, with Base UI for the interactions HTML can't do.
- 12 blocks, the larger parts of a screen, among them DataTable and the page layouts AppShell and WorkbenchShell.
- 5 hero flows, whole screens built from blocks that take data, hrefs and callbacks from your app.
- Tokens for color in four themes (`light`, `dark`, `light-hc` and `dark-hc`), type, spacing, radius, motion and more.

### Fixed before release

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
