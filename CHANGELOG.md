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
  the value is fixed. A failed submit makes the field invalid before focus reaches it and announces the errors, so a
  field that already had focus is heard too.
- TextField takes a `ref` to its `<input>` or `<textarea>`.
- An invalid TextField shows the focus ring outside its red edge when focused, as errors send focus there.
