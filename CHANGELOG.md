# Changelog

## Unreleased

- A Button whose label wraps is a rounded rectangle, with corners of `--radius-xl` or more. A one-line Button is
  still a capsule and an icon-only one a circle, at every size, shape, density and text size.
- A GlassToolbarButton whose label wraps keeps the curve of one line, so it stays concentric with the toolbar.

## 0.4.0

First public release. Lede is a design system for React, installed from its shadcn registry at
`https://lede.cloudcompute.com/r/v0.4.0/{name}.json`.

- 12 components, each a native element where HTML has one, with Base UI for the interactions HTML can't do.
- 12 blocks, the larger parts of a screen, among them DataTable and the page layouts AppShell and WorkbenchShell.
- 5 hero flows, whole screens built from blocks that take data, hrefs and callbacks from your app.
- Tokens for color in four themes (`light`, `dark`, `light-hc` and `dark-hc`), type, spacing, radius, motion and more.
