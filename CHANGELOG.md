# Changelog

## Unreleased

- `json-render`, titled SpecView, lets a model's reply be a Lede screen. It installs a json-render catalog of 12
  Lede components for the model's prompt, with `rules` that keep its lists on ListGroup, a registry that draws each
  one, `catalog-fit` for the typecheck, `check` for a spec's props, `specFromParts` and `SpecView`. `functions`
  holds `scale`, for a value a spec works out with `$computed`. A SegmentedControl in a spec shows its label, Enter
  in a one-line TextField sends its form, and `SpecView` doesn't send a form while a field fails its browser check.
  `integrations/json-render-chat` uses it in an AI SDK chat.
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
