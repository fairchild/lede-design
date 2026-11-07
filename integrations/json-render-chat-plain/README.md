# json-render and shadcn in a chat, without Lede

The chat from [`../json-render-chat`](../json-render-chat/) with Lede taken out, so the two can be compared side by
side. It has the same transport, server, scripted replies and tests, and the same four screens. json-render draws them
from [`@json-render/shadcn`](https://www.npmjs.com/package/@json-render/shadcn), the shadcn/ui components json-render
publishes for its own renderer. Nothing here imports from `registry/` or reads Lede's tokens.

```bash
npm install
npm run dev     # http://localhost:4870, with the scripted replies
npm run build   # typecheck (app and server), then the site
npm test        # each scripted prompt through the mock, and each spec through the registry
```

## Side by side

Measured on Nov 6, 2026, with json-render 0.22.0 in both.

| | Lede ([`json-render-chat`](../json-render-chat/)) | Plain (this entry) |
| --- | --- | --- |
| Catalog | 12 components, 42 props | 12 components, 47 props (36 and 119 with the whole package) |
| `catalog.prompt({ mode: 'inline' })` | 19,087 characters, 4,778 tokens | 20,383 characters, 5,170 tokens (24,307 and 6,178 with the whole package) |
| Registry code | 140 lines, plus 71 in `catalog-fit.ts` | 22 lines |
| Catalog code | 109 lines | 32 lines |
| Theme CSS in the app | none: it imports Lede's generated tokens | 79 lines: shadcn's neutral theme, as `npx shadcn init` writes it |
| JS and CSS, gzipped | 189 kB and 15 kB | 217 kB and 10 kB |
| axe violations, each reply and all four in one conversation, light and dark | 0 | 0 |
| Checked by hand: duplicate `id`s, unnamed groups, section headings, errors tied to their field | none of these | all four |
| Dark mode | `ThemeProvider`'s `scheme`: light and dark, each with a high-contrast theme under `prefers-contrast: more` | a `.dark` class on `<html>`: light and dark |

Tokens are counted with `o200k_base` from `gpt-tokenizer`, OpenAI's tokenizer, as a stand-in: Claude's own count needs
an API key. Most of each prompt is json-render's own instructions, the same in both. The 1,296
characters between them come from the component list and one example line that names a component. The plain prompt is longer because every shadcn form field carries
`name`, `checks` and `validateOn`, and Card and Stack take a `className`.

`@json-render/shadcn` ships all 36 components in one module, so the bundle carries the ones this catalog leaves out,
with Radix, Vaul, Embla and Lucide behind them.

## What each can express

The Lede catalog names what a screen is made of: a `PageHeader` with its takeaway, a `ListGroup` of `ListRow`s with
a subtitle, a value, a switch and row actions that also work by swipe, a `FormSection` whose legend names its fields,
a `SegmentedControl` with a label, an `EmptyState`, a `SummaryCard` with a figure and a status. Each draws its own
heading at the level the chat sets, so the outline under each reply reads Daybook, Notifications, Delivery.

The shadcn catalog names how a screen is laid out: `Stack`, `Card`, `Heading` and `Text`, with form fields, a `Badge`
and a `ToggleGroup`. A model can build the same four screens from them, and it can reach any Tailwind class through
`className`, though only classes the build already holds take effect. What it can't express, measured against these
four screens:

- A row with a subtitle beside its switch. The `Switch` takes a label only, so “On this device” and “To
  ada@example.com” drop out of the settings screen.
- A field that shows its error on arrival. `Input` has no `error` prop. Its `checks` run on blur, so the sign-up
  reply now says the field reports the missing @ once you leave it.
- A row action under a swipe or in a menu. Each inbox row carries Open and Archive buttons.
- A named choice. `ToggleGroup` has no label, so “Summary email” and “Show” sit in a Card title and the radio group
  itself has no name.
- A section heading. A Card's title is a `<div>`, so Delivery, Today and No projects yet are absent from the heading
  outline, and the model picks heading levels itself.
- A status that says what it means. `Badge` takes a color variant and its text, with nothing that ties the two.

An `Input`'s error shows below it once its check fails, but nothing ties the message to the field: it has no
`aria-describedby` and no `aria-invalid`, so a screen reader moving through the form doesn't hear it.

The fields take their `id` from `name`. Ask for settings and then for sign-up, and both the Email alerts switch and
the Email field get `id="email"`: the field's label then names the switch, and the field is announced by its
placeholder. axe lists this among the results it leaves for a person to review, so the axe row reads 0 for both.

## Why `@json-render/shadcn`

json-render publishes it beside its React renderer, with a ready catalog definition for each component, and its README
shows the path this entry takes: pick the components you need from both halves and pass them to `defineCatalog` and
`defineRegistry`. A developer starting from json-render's docs lands here before writing components of their own, and
shadcn/ui is the default component kit for a React and Tailwind app. The chat around the screens is plain semantic
HTML with the theme's Tailwind classes, and keeps the Lede entry's behavior: the same headings, live status line,
focus handling, Enter to send and Stop.

## A real backend

`server/chat.ts` matches the Lede entry's, with this catalog's prompt.

```bash
ANTHROPIC_API_KEY=… npm run server              # POST /api/chat on port 4872
VITE_CHAT_API=/api/chat npm run dev             # the app, with Vite proxying /api to the server
```

## What it shares

Nothing at build time. `src/mock-transport.ts`, `src/stream.ts` and `server/chat.ts` are copies of the Lede entry's,
`src/check.ts` checks props the same way, and `specs/` holds the four recorded screens written in this catalog's
components.
