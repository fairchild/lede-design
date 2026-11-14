# Lede

Lede is a design system for React: components, blocks and hero flows, installed from a shadcn registry. Every screen,
section and row leads with its takeaway, and detail opens on request. The name is the journalist's word for a story's
opening line.

This system is generated from [fairchild/lede-design](https://github.com/fairchild/lede-design) at Lede {{VERSION}}
(`{{SHA}}`). Its tokens, its stylesheet and every component's markup come from the code, so a page built from it
matches an app built with the registry. Docs: [lede.cloudcompute.com](https://lede.cloudcompute.com/). A visual tour
of the foundations and components: [the Lede canvas]({{CANVAS_URL}}).

## Build with it

Pick the line for where the work runs. Each one uses the same tokens and class names.

| Where | How |
| --- | --- |
| A React app (Claude Code, a repo) | Install from the registry: `npx shadcn@latest registry add '@lede={{REGISTRY_URL}}'`, then `npx shadcn@latest add @lede/theme-provider @lede/<item>`. Each component's card has the command and a working sample. |
| An HTML artifact (Claude Code or a chat) | Copy this system's stylesheet into the artifact and use Lede's markup. See "An HTML page or artifact" below. |
| A design canvas or a deck | Choose Lede as the design system. Mirror the markup in each component's card and use the tokens by name. |
| Generated UI from a model | `@lede/json-render` draws a json-render spec with Lede's components. |

### An HTML page or artifact

`components/bundle.css` is all of Lede's CSS in one file: every token in four themes, every component and block. It
needs no build step and no Tailwind.

1. Copy it into the artifact. With an Artifact tool that takes `files`, the server copies it from this system:
   `"files": {"lede.css": {"artifact": "{{DESIGN_SYSTEM_URL}}", "path": "project/components/bundle.css"}}`.
   Without that, read `project/components/bundle.css` and put it in a `<style>` element.
2. Link it and wrap the page in `ld-theme`, with the theme on the same element.
3. Build from the markup in each component's card under "Use it in an HTML page or artifact". It is what the React
   component renders, so keep its elements, classes and ARIA attributes.

A page that follows the reader's light, dark and contrast settings:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Weekly review</title>
  <link rel="stylesheet" href="lede.css">
  <script>
    // Lede's four themes, picked from the reader's settings. ThemeProvider does this in React.
    const theme = () => {
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      const more = matchMedia('(prefers-contrast: more)').matches;
      document.documentElement.dataset.theme = (dark ? 'dark' : 'light') + (more ? '-hc' : '');
    };
    theme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', theme);
    matchMedia('(prefers-contrast: more)').addEventListener('change', theme);
  </script>
</head>
<body style="margin:0">
  <div class="ld-theme" data-surface="grouped" style="min-height:100dvh; padding: var(--space-6) var(--space-4)">
    <main style="max-width: 640px; margin: 0 auto; display: grid; gap: var(--space-6)">
      <header class="ld-page-header">
        <div class="ld-page-header-row">
          <div class="ld-page-header-text">
            <h1 class="text-large-title ld-page-title">Weekly review</h1>
            <p class="ld-page-summary">2 decisions need you by Thursday</p>
          </div>
        </div>
      </header>
      <!-- Lede components here: copy each from its card. -->
    </main>
  </div>
</body>
</html>
```

- **Theme.** `data-theme` takes `light`, `dark`, `light-hc` or `dark-hc`, on `<html>` or on any element with
  `ld-theme`.
- **Accent.** Set `--primary` on the `ld-theme` element to a preset: `style="--primary: var(--preset-teal)"`. The
  presets are blue, indigo, teal, green, orange, pink and graphite, each tuned for contrast in every theme.
- **Shape.** `data-shape="soft"` (22px), `"crisp"` (12px) or `"square"` (4px) on an element with `data-theme` sets
  `--radius`, and every corner follows.
- **Density.** `data-density="regular"`, `"compact"` or `"touch"` beside `data-theme` sets control heights and hit
  areas.
- **Type.** Each type style is a class: `text-large-title`, `text-title-1` … `text-body`, `text-footnote`,
  `text-caption-2`.

## Rules

- **Semantic HTML first.** Use the native element when there is one: `<button>`, `<a href>`, `<fieldset>`, `<nav>`,
  `<section>` with a heading, `<ul>`. Navigation is a link and an action is a button. Never `div role="button"`, and
  never put one interactive element inside another.
- **One `h1` per screen**, in the page header. Every region has a name, and headings don't skip a level.
- **Takeaway first.** Every screen, section and row leads with what it means: a page summary, a list summary, a row's
  value. Affordances are quiet (a chevron in `--muted-foreground`, a count) and appear where they're used. A swipe or a
  shortcut always has a visible twin. Nothing opens on its own.
- **Hierarchy.** Glass and `--shadow-float` only on controls that float over content. One filled button per view.
- **Tokens only.** No raw colors or radii. In shadcn naming `--primary` is the brand hue and `--accent` is the subtle
  hover surface. Text on a tinted fill uses `--ld-primary-on-tint`.
- **Concentric corners.** A child's radius is its parent's minus the padding between them: `--radius-xl` 30,
  `--radius-lg` 22, `--radius-md` 14, `--radius-sm` 10, `--radius-xs` 6 at the default shape. Anything pressable is a
  capsule.
- **Contrast.** 4.5:1 for text and 3:1 for UI marks in light and dark; text rises to 7:1 in the `-hc` themes. Status
  always has a word or an icon with its color.
- **Reader settings.** Follow `prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-motion` and
  `prefers-reduced-transparency`. The stylesheet handles motion and transparency; the page picks the theme.
- **Copy.** Sentence case. A button starts with a verb and names the outcome. A summary leads with the number or the
  state ("2 decisions need you by Thursday"). An error says how to fix it. US English, no emoji.

## Foundations

- **Color.** One interactive hue, `--primary`, on neutral surfaces. `--background-grouped` sits behind grouped
  content, `--card` raises it and `--muted` nests inside a card. `--muted-foreground` carries summaries and values.
  `--destructive`, `--success` and `--warning` mean a state and always come with a word.
- **Type.** The platform's system face, set in rem so it follows the reader's text size. A 17px body; `caption-2` at
  11px is the floor.
- **Space.** A 4px grid, with 2px and 6px half steps inside one control.
- **Motion.** Springs for things that move, eases for things that fade. Under reduced motion every duration is 1ms.

| Token | Value | Use |
| --- | --- | --- |
{{MOTION}}

## Components

Each card shows Lede's markup for the docs site's sample, the React install command and the sample's code.

{{COMPONENTS}}

The hero flows (Daily brief, Inbox, Settings, Onboarding and Profile) are whole screens built from these. They are in
the registry and in [Daybook](https://lede.cloudcompute.com/app), the demo app.
