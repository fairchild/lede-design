---
name: lede-design-system
description: Use when building, designing or reviewing UI with the Lede design system — when asked to use Lede, or when a project includes Lede (components/lede/, an @lede shadcn registry, Lede tokens).
---

# Lede design system

Lede is a content-first design system inspired by Apple's Human Interface Guidelines. Its principles are **Hierarchy, Harmony, Consistency** and **Progressive disclosure**. It's built on Base UI with semantic HTML, uses shadcn/ui variable names, and has four themes: `light`, `dark`, `light-hc` and `dark-hc`.

## Where it lives
- **Source repository:** the repo that holds `tokens/tokens.json`. Its public address is github.com/fairchild/lede-design, and the docs site and hosted registry are at lede.cloudcompute.com.
  - `tokens/tokens.json`: the single source for every token.
  - `registry/lede/`: primitives. `blocks/` holds layouts and higher-level components; `flows/` holds the hero flows.
  - `src/`: the docs site and demo app.
  - `registry.json`: the shadcn registry.
  - `CONTRIBUTING.md`: the layers, the rules and the Writing section. `CLAUDE.md`: commands and agent notes.
- **In a project that uses Lede:** components are under `components/lede/` (with `blocks/` and `flows/`), styles are under `styles/lede/`, and `components.json` may map `@lede` to a registry URL.
- **A Lede design system page or artifact**, if the session has one: read its own overview first, then its tokens and each component's guidelines.

Read the repo's current `README.md` or `CONTRIBUTING.md` before building. Token names and component APIs change, so don't work from memory.

## Choose the layer
1. A **flow**, if one fits: `DailyBriefFlow`, `InboxFlow`, `SettingsFlow` / `AppearanceFlow`, `OnboardingFlow`, `ProfileFlow`.
2. Otherwise compose **blocks**: `AppShell`, `WorkbenchShell`, `PageHeader`, `SummaryCard`, `MasterDetail`, `FormSection`, `StepIndicator`, `EmptyState`, `SelectionBar`, `AccentPicker`, `DataTable` (with `useServerRows` for server-side rows).
3. Build from **primitives**: `Button`, `SegmentedControl`, `Switch`, `TextField`, `Card`, `ListGroup` / `ListRow`, `Checkbox`, `Table` (table parts, with an optional collapsible caption), `Disclosure`, `Avatar`, `GlassBar` / `GlassToolbar`, `ThemeProvider`, `ThemeScope`, `LinkProvider`.

Flows are router-agnostic: data, hrefs and callbacks go in, and they do no fetching. Add a new pattern only when no existing one fits, and document why.

## By context
- **Working in the Lede repo:** follow `CONTRIBUTING.md` and `CLAUDE.md`. Edit `tokens/tokens.json`, never generated CSS. `npm run build` and `npm test` (Playwright + axe in all four themes) must pass.
- **Another React app:** Lede is client-rendered, so use a Vite app or another client-only React app; server rendering isn't supported yet. Install from the hosted registry, following the README's "Use it in a shadcn project": add `https://lede.cloudcompute.com/r/v<version>/{name}.json` as `@lede`, pinned to a release, then `npx shadcn@latest add @lede/theme-provider @lede/<item>`. Each component brings in `lede-theme`. Import `styles/lede/index.css` after the shadcn globals. Wrap the app in `<ThemeProvider surface="grouped" className="min-h-dvh">`, so the page itself takes the theme, and in `LinkProvider` with the router's link component.
- **A plain HTML page or artifact with no build step:** copy the token values into `:root`, `[data-theme="…"]`, `[data-theme][data-shape="…"]` and `[data-theme][data-density="…"]` blocks under the same names (`--primary`, `--muted-foreground`, `--radius`…). A value keyed by theme, shape or density puts its first key in `:root`. `data-shape` and `data-density` go on an element that also has `data-theme`, so the blocks apply and the derived radii and hit sizes recalculate. Each type style becomes `--text-<style>-size`, `-line-height` and `-weight`, plus `-letter-spacing` if the style has one. A token's `reducedMotion` value goes, with `!important`, in a `:root, [data-theme]` block inside `@media (prefers-reduced-motion: reduce)`, and a family marked `emit: false` isn't copied. Mirror the component markup and class names. Never invent tokens.
- **A design or mockup:** compose from the blocks and flows, and apply the rules below.
- **Changing Lede itself:** change the repo (tokens, then components, then docs and tests), then update any mirror of it, such as a design system page.

## Rules
- **Semantic HTML first.** Use the native element if one exists. Use Base UI only when HTML can't do the interaction. Use ARIA only for what HTML can't express. Navigation is `<a href>` and actions are `<button>`. Never use `div role="button"`, and never nest interactive elements. Name every region. Use one `h1` per screen (PageHeader), and don't skip heading levels.
- **Progressive disclosure.** Every screen, section and row leads with its takeaway: a PageHeader `summary`, a Disclosure `summary`, a ListGroup `summary`, a row `value`. Affordances are quiet (a chevron in `muted-foreground`, a count) and appear at the point of use. Expert paths (swipe, shortcuts) always have a visible twin one level deeper. Nothing opens on its own.
- **Hierarchy.** Glass and `shadow-float` only on controls that float over content. One `filled` button per view.
- **Harmony.** Radii derive from the `--radius` seed (22px by default) and `--radius-step` (8px): `--radius-xl` 30, `lg` 22, `md` 14, `sm` 10, `xs` 6. A child's radius equals the parent's radius minus the padding. Anything pressable is a capsule.
- **Tokens only.** In shadcn naming, `primary` is the brand hue and `accent` is the subtle hover surface. Text on a tinted fill uses `--ld-primary-on-tint`.
- **Overlays.** Every portal, including one inside another overlay, has `ThemeScope` directly inside it. Without it the overlay silently loses its provider's theme.
- **Contrast:** 4.5:1 for text and 3:1 for UI marks. Text rises to 7:1 in the `-hc` themes, and UI marks stay at 3:1. Status always carries a word as well as colour.
- **Respect user settings:** `prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-motion` and `prefers-reduced-transparency`.
- **Copy:** sentence case. Buttons start with a verb and name the outcome. Summaries lead with the number or the state ("2 decisions need you by Thursday"). Errors say how to fix the problem. No emoji.

## Review checklist
- One `h1`, named landmarks, no `div` buttons, no nested interactives.
- Every level has a summary that someone can act on without opening it.
- Only tokens; concentric radii.
- Every portal has `ThemeScope` directly inside it.
- Contrast passes in all four themes; axe is clean.
