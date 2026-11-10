# <picture><source media="(prefers-color-scheme: dark)" srcset=".github/assets/mark-dark.png"><img alt="" src=".github/assets/mark-light.png" width="40" height="40" align="top"></picture> Lede

Lede is a design system for React, installed from a shadcn registry. Every screen, section and row leads with its
takeaway, and detail opens on request. The name is the journalist's word for a story's opening line.

[Docs](https://lede.cloudcompute.com/) · [Daybook, the demo app](https://lede.cloudcompute.com/app) ·
[Install](#use-it-in-a-shadcn-project) · [Changelog](CHANGELOG.md)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/inbox-dark.png">
  <img alt="Daybook's inbox: a list of messages beside the open one, each row leading with its subject and sender." src="docs/screenshots/inbox-light.png">
</picture>

## What's in it

| Layer | What it is | Examples |
| --- | --- | --- |
| [Tokens](https://lede.cloudcompute.com/foundations) | Color in four themes, type, spacing, radius and motion, under shadcn's variable names. | `--primary`, `--radius`, `--fill-control` |
| [Components](https://lede.cloudcompute.com/components) | Primitives, each a native element where HTML has one. | Button, Switch, ListGroup, Table |
| [Blocks](https://lede.cloudcompute.com/blocks) | The larger parts of a screen, page layouts among them. | AppShell, PageHeader, DataTable |
| [Flows](https://lede.cloudcompute.com/app) | Whole screens built from blocks. You pass data, hrefs and callbacks. | InboxFlow, OnboardingFlow |

Each layer builds on the one above it, and you install only the items you use. Stock shadcn components take on Lede's
theme too, because the tokens keep shadcn's names.

Components use [Base UI](https://base-ui.com) for the interactions HTML can't do, and ARIA only for what HTML can't
express. [Decisions](https://lede.cloudcompute.com/decisions) records how Lede is built and what checks it.

Lede is inspired by Apple's Human Interface Guidelines: **Hierarchy, Harmony, Consistency** and **Progressive
disclosure**.

*Lede is an independent project with no affiliation with Apple, and Apple doesn't endorse it. It ships no Apple fonts,
icons or assets.*

## Use it in a shadcn project

You need Node 22.12 or later and a client-rendered React 19 project, such as a Vite app, with Tailwind v4, the `@/*`
path alias and a `components.json`. `npx shadcn@latest init` creates that file. [Limits](#limits) covers server
rendering.

1. Add the registry and the items you want. Keep `@lede/theme-provider` in the list: step 4 needs it, and most items
   don't install it.

   ```bash
   npx shadcn@latest registry add '@lede=https://lede.cloudcompute.com/r/v0.4.0/{name}.json'
   npx shadcn@latest add @lede/theme-provider @lede/data-table @lede/daily-brief @lede/inbox
   ```

   The CLI copies the source into your project and installs what each item depends on. The URL pins a release, and a
   release's files never change.

2. Import the styles once, at the end of your global CSS file, after your shadcn globals. The path is relative to that
   file. This one suits `src/index.css`.

   ```css
   @import "./styles/lede/index.css";
   ```

3. Import each component from its own file. Components land in `components/lede/` and styles in `styles/lede/`, under
   `src/` if your project has one.

   ```tsx
   import { ListGroup, ListRow } from '@/components/lede/list';
   ```

4. Wrap your app in `ThemeProvider` and `LinkProvider`. `surface="grouped"` and `min-h-dvh` make the wrapper paint the
   theme's background over the whole page. `LinkProvider` routes Lede's links through your router, so leave it out if
   you have none.

   ```tsx
   import { LinkProvider } from '@/components/lede/link';
   import { ThemeProvider } from '@/components/lede/theme-provider';
   import { RouterLink } from './router-link';

   <ThemeProvider surface="grouped" className="min-h-dvh">
     <LinkProvider component={RouterLink}>
       <App />
     </LinkProvider>
   </ThemeProvider>
   ```

   For React Router, `src/router-link.tsx` is this adapter.

   ```tsx
   import { Link } from 'react-router';
   import type { LinkComponent } from '@/components/lede/link';

   export const RouterLink: LinkComponent = ({ href, ref, ...props }) =>
     /^(https?:|mailto:|tel:|#)/.test(href) ? <a ref={ref} href={href} {...props} /> : <Link ref={ref} to={href} {...props} />;
   ```

To move to a later release, read the [CHANGELOG](CHANGELOG.md), change the version in the registry URL in
`components.json` and run the same `add` with `-o`. That overwrites your copies, including any edits you made to them.

## Limits

- **Client rendering only.** Registry files have no `'use client'`, so Next's App Router fails at build. Inside a
  `'use client'` file it builds, but `scheme="auto"` doesn't follow a dark OS after hydration.
- **`body` stays white.** Without `surface="grouped"` and `min-h-dvh` on `ThemeProvider`, a dark theme puts light text
  on white.
- **Install from the registry URL.** The CLI's `owner/repo/item#tag` addresses don't work for Lede: `lede-theme` needs
  a CSS file the build generates, and the `@lede/…` dependencies need a registry.
- **Nested themes reach stock shadcn utilities.** A light [`ThemeProvider`](https://lede.cloudcompute.com/components#c-theme)
  inside a dark one sets Lede's tokens, and stock `dark:` utilities, high contrast and `glass="solid"` still match
  inside it, as under shadcn's own `.dark` class.

## Develop

The docs site and Daybook run at http://localhost:5173 with `npm run dev`. Run `npm run build` before `npm test`.

```bash
npm install
npx playwright install chromium   # first run only
npm run dev        # the docs site and Daybook
npm run build      # tokens, registry, typecheck, then the site
npm test           # Playwright and axe on every route, in four themes
npm run contrast   # the contrast check alone
```

[CONTRIBUTING.md](CONTRIBUTING.md) covers how the code is organized, the rules every component follows, pull
requests and writing.

[`integrations/`](integrations/) holds small apps that show Lede beside other projects, starting with json-render.

## License

[MIT](LICENSE). Lede builds on [Base UI](https://base-ui.com) (MIT), [React Aria](https://react-spectrum.adobe.com/react-aria/) (Apache-2.0) and [TanStack Table](https://tanstack.com/table) (MIT).
