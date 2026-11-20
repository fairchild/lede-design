# Lede on claude.ai: a design system of your own

Claude builds with Lede wherever it works. In a repo it installs from the registry and reads the docs. On claude.ai,
in a chat artifact, a design canvas or a deck, there's nothing to install, so Claude builds from a **design system**:
an artifact that holds Lede's tokens, its stylesheet, its components and the guidance for using them. This repo
generates that design system, and anyone with a claude.ai account can publish it to their own.

## Why it exists

A design system is what Claude reads before it makes a page, a canvas or a slide. Without one, Claude on claude.ai
knows Lede only by name and approximates it: close colors, invented class names, components that look right and
don't behave. With one:

- **The tokens are exact.** Colors in all four themes, the type scale, spacing and the concentric radii come from
  `tokens/tokens.json`.
- **The components are real.** `components/bundle.js` is every registry export as `window.Lede`, built from the same
  source the registry ships, with React 19 carried in `components/lib/`. A canvas or an artifact mounts Lede's Switch,
  Disclosure or InboxFlow instead of copying their markup, and each card's preview is that component, working.
- **The guidance travels with them.** The README holds Lede's rules (semantic HTML first, the takeaway first, one
  filled button per view), and each card has the component's props, variants, accessibility, React sample and HTML.
- **It matches the code.** It's generated, so a page built from it matches an app built with the registry at the same
  version.

## Why your own

A design system on claude.ai is an artifact, and an artifact belongs to the account that made it. It's private until
its owner shares it, and Claude can use only the design systems your account can open. Lede's maintainers publish one
for their own work, which the docs link; it doesn't open for anyone it isn't shared with.

So the pattern is: **each account, or each team, publishes its own from this repo.** It takes a few minutes, and you
control when it updates. A team can publish one and share it, so everyone's Claude reads the same Lede.

## Publish yours

You need a claude.ai account with artifacts, and [Claude Code](https://claude.com/claude-code) signed in to it.
Publishing sends over a hundred files, which takes an Artifact tool that sends files from disk, as Claude Code's does.

1. **Make the design system.** In Claude Code, ask:

   > Make a new design system artifact named Lede from the Design System type, with no files yet, and give me its link.

   Claude makes an empty one and answers with its link, such as `https://claude.ai/artifact/AbC123…`. Design System
   is one of the artifact types claude.ai offers; if your account doesn't list it, ask Claude which types it has.

2. **Build Lede's files for it.** In a checkout of this repo, at a release tag such as `v0.6.0`:

   ```bash
   npm ci
   npm run design-system -- --url https://claude.ai/artifact/AbC123…
   ```

   `--url` names your design system in its README, where it tells a reader how to copy files from it. The files land
   in `dist-design-system/project/`. Add `--canvas <link>` if you also have a canvas of Lede's foundations to link.

3. **Check it.**

   ```bash
   npm run design-system:check
   ```

   It loads every card's preview the way the design system page does and fails if one doesn't mount, logs an error,
   asks for a file the system doesn't have or takes focus. The first run needs `npx playwright install chromium`.

4. **Publish.** Ask Claude Code:

   > Publish every file under dist-design-system/project/ to https://claude.ai/artifact/AbC123…, following the Design
   > System type's instructions: the files under project/, design-system.json last.

   Then open the link. The Overview shows the cover and the README, Components shows a working card for each item,
   and the token pages show Lede's colors, type, spacing and radii.

## Use it

- **In a chat:** name it ("use the Lede design system") and Claude reads its README first, then the cards it needs.
- **In a canvas or a deck:** choose Lede as the design system. The canvas loads the bundle, so Claude can mount components
  from `window.Lede` as well as follow their markup.
- **In an HTML artifact:** the README's "Build with it" says how to copy the stylesheet, React and the bundle into
  the artifact, and how to mount a component.
- **In Claude Code, in a repo:** install from the registry instead, as the [README](../README.md) shows. The design
  system is for where there's no install.

## Keep it current

Lede changes with each release, and your design system changes only when you publish. After a release:

1. Save your design system's live `project/design-system.json`: ask Claude Code to read that path from your artifact
   and save it. It holds what the page keeps for itself, such as a title you changed or sections you added.
2. Check out the new release's tag and rebuild, passing that file so its keys survive:

   ```bash
   npm ci
   npm run design-system -- --url https://claude.ai/artifact/AbC123… --index path/to/design-system.json
   npm run design-system:check
   ```

3. Publish again, to the same link, as in step 4 above.

The README of each build names the Lede version and commit it came from, and the index's `lastChange` says who
published it and when.

## A design system from a fork

The generator reads only this repo: change `tokens/tokens.json` in a fork, and your design system carries your colors,
type and radii with Lede's components. `scripts/design-system/README.md` and `cover.html` are the README and cover
templates. CONTRIBUTING.md's "How the code is organized" says how the generator works.

## What's in it

| File, under `project/` | What it holds |
| --- | --- |
| `README.md` | What Lede is, how to build with it in each place, the rules and the foundations |
| `tokens.json` | Every token in the shape the design system page reads: colors in four themes, type, spacing, radii, shadows |
| `components/bundle.css` | All of Lede's CSS in one file, with no build step and no Tailwind |
| `components/bundle.js` | Every registry export as `window.Lede` |
| `components/lib/` | React and ReactDOM 19, which the bundle reads as `window.React` and `window.ReactDOM` |
| `components/<Name>/` | A card per registry item with a docs sample: its guide (`README.md`), its live preview and its types |
| `components/index.d.ts` | Every module's declarations, with their doc comments |
| `components/Cover/` | The cover shown above the README |
| `design-system.json` | The index: the system's name, its libraries and what the page keeps |
