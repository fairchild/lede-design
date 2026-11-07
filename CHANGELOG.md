# Changelog

## Unreleased

- `json-render`, titled SpecView, lets a model's reply be a Lede screen. It installs a json-render catalog of 12
  Lede components, `prompt()`, which gives a model json-render's prompt in this catalog's terms with Lede's `rules`, a
  registry that draws each component, `catalog-fit` for the typecheck, `check` for a spec's props, `specFromParts` and
  `SpecView`. `functions` holds `scale` and `remaining`, for values a spec works out with `$computed`. An action that
  reads a field failing its browser check doesn't run: each such field shows its `error`, a plain string, until the
  person's input makes it pass, and focus moves to the first. Enter in a one-line TextField runs its actions, a number
  field keeps a number in state and takes decimals unless `step` says otherwise, a TextField takes `pattern`,
  `minLength` and `maxLength`, and a SegmentedControl or Checkbox in a spec can be required and show an error.
  `SpecView` takes input while a spec streams and keeps what the person changed, reports the screen's state through
  `onStateChange`, moves focus on when a press hides the control that made it and warns in development when Lede's
  CSS isn't loaded. It needs `@json-render/core` and `@json-render/react` at exactly 0.22.0.
  `integrations/json-render-chat` uses it in an AI SDK chat.
- SegmentedControl takes `required`, `aria-describedby` and `aria-invalid`, and with a value outside its options it
  shows no option as chosen.
- `ld-checkbox-field` on a `<label>` that holds a Checkbox keeps a long label in a column beside the box, with the
  default cursor while the Checkbox is disabled.
- EmptyState's `headingLevel` takes 4.
- A PageHeader inside a flow's stack drops its bottom margin, so the space under it stays one step when an
  inline-level control, such as a SegmentedControl, comes next.

## 0.4.0

First public release. Lede is a design system for React, installed from its shadcn registry at
`https://lede.cloudcompute.com/r/v0.4.0/{name}.json`.

- 12 components, each a native element where HTML has one, with Base UI for the interactions HTML can't do.
- 12 blocks, the larger parts of a screen, among them DataTable and the page layouts AppShell and WorkbenchShell.
- 5 hero flows, whole screens built from blocks that take data, hrefs and callbacks from your app.
- Tokens for color in four themes (`light`, `dark`, `light-hc` and `dark-hc`), type, spacing, radius, motion and more.
