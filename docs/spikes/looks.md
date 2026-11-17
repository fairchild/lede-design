# Spike: looks (re-theming Lede without changing behaviour)

Status: experiment, not for merge. Branch `claude/project-thread-89gzwy`.

## What it is

A *look* is a whole visual style laid over Lede: one attribute, `data-look`, on `<html>`. Three looks live in
`src/styles/looks.css`: `skeuo` (Skeuomorphic), `brutal` (Neo-brutalist) and `broadsheet` (editorial, newsprint).
The demo site shows a Look picker at the bottom right (`src/look-switcher.tsx`); `?look=brutal` picks one from the
URL and `?chrome=0` hides the picker for screenshots. No component markup, React code or Base UI wiring changed.

Each look has two parts, so the split itself is the finding:

1. **Tokens**: values for existing variables only (color, shadow, radius, font, weight, blur, motion).
2. **Beyond tokens**: CSS rules that reach into `.ld-*` classes because no token covers the property.

## What the tokens couldn't reach

| Gap | Looks that hit it | Candidate token |
| --- | --- | --- |
| Stroke widths are hard-coded `0.5px` / `1px` (rows, cards in -hc, fields, segmented control) | brutal | `--stroke-surface`, `--stroke-control`, `--stroke-separator` |
| Fills are flat colors; no gradient or bevel | skeuo | `--fill-*-image` / a surface "material" |
| Cards and lists have no edge or elevation of their own | all three | `--surface-edge`, `--surface-shadow` |
| Pressed state is fixed to `scale(var(--scale-pressed))` | brutal, skeuo | `--press-transform`, `--press-shadow` |
| Text case and variant (uppercase, small caps) | brutal, broadsheet | `text-transform` / `font-variant` per type style |
| List container style (boxed card vs ruled column) | broadsheet | a structural variant, not a value |
| Background texture | skeuo | `--background-image` |
| Accent: ThemeProvider sets `--primary: var(--preset-<accent>)` inline, so a look must override `--preset-blue`, not `--primary` | all | a look-aware accent default |

## Open questions

- Accent and corner settings on Appearance conflict with a look (Broadsheet's "Blue" accent renders red). Does a
  look lock them, or are they tweaks on top?
- Contrast: looks sit outside `tokens/tokens.json`, so `npm run contrast` and the -hc themes don't cover them.
- Promote looks to a `tokens.json` axis like `shape` and `density`, so the registry, the design-system bundle and the
  contrast gate all get them.
