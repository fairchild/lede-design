# Lede

> Lede {{VERSION}} is a design system for React: components, blocks, page layouts and hero flows, installed from a shadcn registry. Every screen, section and row leads with its takeaway, and detail opens on request.

Lede renders on the client only, so it suits a Vite app or another client-only React app. Install from a release's registry, `https://lede.cloudcompute.com/r/v{{VERSION}}/{name}.json`, added to `components.json` as `@lede`. Every item's file is at that URL with its name, such as `button` or `data-table`, and the release's index is `https://lede.cloudcompute.com/r/v{{VERSION}}/registry.json`. A release's files never change.

Each docs page has a Markdown version at its address plus `.md`, such as https://lede.cloudcompute.com/components.md, with https://lede.cloudcompute.com/overview.md for the home page, and each registry item has a reference page. The links under Docs and the item sections go to them, and [llms-full.txt](https://lede.cloudcompute.com/llms-full.txt) holds all of them in one file. Together they're an Open Knowledge Format v0.2 bundle, whose index is [index.md](https://lede.cloudcompute.com/index.md).

## Docs

{{DOCS}}

{{ITEMS}}

## Registry

- [Registry index](https://lede.cloudcompute.com/r/registry.json): JSON that lists every item of the latest release, with its name, type, title, description, dependencies and file paths
- [Button](https://lede.cloudcompute.com/r/button.json): one item's JSON, with the source of each file, as `npx shadcn@latest add` reads it
- [Next index](https://lede.cloudcompute.com/r/next/registry.json): the same list for the head of `main`, which changes with each merge; its items are at `/r/next/{name}.json`

## Agents

- [Agent skill](https://raw.githubusercontent.com/fairchild/lede-design/main/.claude/skills/lede-design-system/SKILL.md): the `lede-design-system` skill, the rules for building and reviewing UI with Lede
- [json-render chat recipe](https://raw.githubusercontent.com/fairchild/lede-design/main/integrations/json-render-chat/AGENTS.md): the steps, in order, for a chat whose replies hold Lede screens, on the AI SDK and json-render
- [README](https://raw.githubusercontent.com/fairchild/lede-design/main/README.md): what Lede is and how to install it. Its Limits section covers server rendering, the page background and installing from the registry URL

## Claude

These two links are readable only inside Claude, such as a claude.ai chat or Claude Code. A fetch from anywhere else gets a script page without their contents.

- [Lede design system on claude.ai](https://claude.ai/artifact/Cw9GgaD1zxRk9ewxGMHv4x): tokens, the whole stylesheet (`project/components/bundle.css`) and each component's React sample and rendered HTML, generated from this repo. Read its `project/README.md` first. An HTML artifact copies the stylesheet with `"files": {"lede.css": {"artifact": "https://claude.ai/artifact/Cw9GgaD1zxRk9ewxGMHv4x", "path": "project/components/bundle.css"}}`
- [Lede canvas](https://claude.ai/artifact/7eECQYRQWxSkaJhwRtT4rJ#artboard-15dd8cd198dd): the foundations and components drawn with Lede's own CSS, in four themes

## Source

- [Repository](https://github.com/fairchild/lede-design): the source on GitHub
- [CHANGELOG](https://raw.githubusercontent.com/fairchild/lede-design/main/CHANGELOG.md): what each release changed
- [CONTRIBUTING](https://raw.githubusercontent.com/fairchild/lede-design/main/CONTRIBUTING.md): the layers, the rules and the writing rules

## Optional

- [Daybook](https://lede.cloudcompute.com/app): the demo app, built from Lede's hero flows
