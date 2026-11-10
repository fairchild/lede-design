# Changelog

## 0.4.0

First public release. Lede is a design system for React, installed from its shadcn registry at
`https://lede.cloudcompute.com/r/v0.4.0/{name}.json`.

- 12 components, each a native element where HTML has one, with Base UI for the interactions HTML can't do.
- 12 blocks, the larger parts of a screen, among them DataTable and the page layouts AppShell and WorkbenchShell.
- 5 hero flows, whole screens built from blocks that take data, hrefs and callbacks from your app.
- Tokens for color in four themes (`light`, `dark`, `light-hc` and `dark-hc`), type, spacing, radius, motion and more.

### Fixed before release

- ListRow: a row with `href` runs its `onClick` too. A row action that removes its row keeps the reader's place: focus
  moves to the next row, else the one before, else the group's heading, else the next control in reading order. A
  parent that moves focus itself, as InboxFlow does, keeps its choice. A swipe action that leaves its row in place
  moves focus to the row as the actions close.
- MasterDetail: a `detail` of `false`, `true`, `''` or `0` counts as nothing selected, so `selected && <Message />`
  works. When the panes swap on a narrow screen, focus moves to the detail's first heading as it opens and back to the
  row that opened it as it closes.
- WorkbenchShell: a shell too narrow for its main pane, with both panels collapsed, draws them at 0 wide where it
  drew `NaN`.
- ThemeProvider: its doc comment and the README say that stock shadcn `dark:` utilities, high contrast and
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
