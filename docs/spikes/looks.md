# Spike: looks (re-theming Lede without changing behaviour)

> **0.8.0:** the `look-*` tokens named below were renamed into the `stroke`, `slot` and `lettering` families. CHANGELOG.md has the table of old and new names.
> A look is now a theme setting: its values live in `looks` in `tokens/tokens.json`, the token build writes them to
> `src/styles/looks/<id>.css`, and `<ThemeProvider look="brutal">` (or `data-look` on a theme root) applies one.
> `src/styles/looks.css` keeps only the rules no token reaches. The `<html>` mechanism described below is history.

Status: merged into `develop` in #123 for 0.7.0. The `look-*` tokens ship in the registry; the three looks stay
the site's own. The next step is a `look` axis in `tokens.json` (Open questions,
below).

A *look* is a whole visual style laid over Lede: `data-look` on `<html>`. Three looks live in `src/styles/looks.css`:
`skeuo` (Skeuomorphic), `brutal` (Neo-brutalist) and `broadsheet` (a newspaper page). The docs page `/looks`
(`src/pages/docs/Looks.tsx`) explains how a look sits on the principles, how to make one, and each look's sources.
The demo site has a Look picker at the bottom right in `npm run dev`; `?look=brutal` picks one in any build.

## Round 2: the `look-*` tokens

Round 1 found what tokens couldn't reach. Round 2 added a `look` family to `tokens/tokens.json` and wired components to
it, so a look sets values instead of restyling components. Every default draws Lede's own look, so today's site is
unchanged.

| Token | Replaces |
| --- | --- |
| `look-hairline` | hard-coded `0.5px` separators |
| `look-control-edge` | hard-coded `1px` edges on fields, switch tracks and the selected segment |
| `look-surface-edge` | no way to outline or lift a Card, list, Disclosure, summary card or message |
| `look-control-shadow`, `look-control-sheen` | flat-only Button fills |
| `look-well` | no way to set a field, segmented control or switch track into the surface |
| `look-press`, `look-press-shadow` | the pressed state fixed to `scale()` |
| `look-ui-font` | one face for reading and for the interface |
| `look-label-case`, `-tracking`, `look-button-case`, `look-title-case` | type tokens without letter case |
| `look-texture` | no background-image on the ground |

What's left per look ("beyond tokens") is listed on the Looks page. Candidates for the next tokens: a text-shadow, a
tint color separate from the accent, and a separator inset.

## Open questions

- Accent and corner settings on Appearance still apply on top of a look. A look sets the default accent
  (`--preset-blue`), so picking another accent works, and corners are set by the look.
- Contrast: looks sit outside `tokens/tokens.json`'s color themes, so `npm run contrast` and the -hc themes don't
  cover them. Promoting looks to an axis in `tokens.json` (like `shape` and `density`) would give them the contrast
  gate, the registry and the design-system bundle.
